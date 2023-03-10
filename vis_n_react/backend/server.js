const express = require('express');
const app = express();
const spawn = require('child_process').spawn;
const cors = require("cors");
const multer = require('multer');
const bodyParser = require('body-parser');
const errorHandler = require('./middleware/errorHandler');
const { logger } = require('./middleware/logEvents');
const PORT =  process.env.PORT || 3500;

app.use(logger);

// CORS: (Cross Origin Resource Sharing) remove all development urls and the !origin
const whitelist = ['http://localhost:3000'];
const corsOptions = {
    origin: (origin, callback) => {
        if(whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.json());

var storage = multer.diskStorage({
    destination: (req, file, callback) => {

        callback(null, './glmUploads');
    },
    filename: (req, file, callback) => {

        callback(null, file.originalname);
    }
});

var upload = multer({storage: storage}).array('glmFile', 4);

app.post("/upload", (req, res) => {

    upload(req, res, (error) => {
        if (error instanceof multer.MulterError) {

            return res.status(500).end("Error uploading files involving multer.");
        }
        else if (error)
        {
            return res.status(500).end("Error uploading files.");
        }
    });
    
    var outputData;
    let i = 0;
    
    const python = spawn('python', ['./py/glm2json.py', './glmUploads/']);

    python.stdout.on('data', (data) => {
        
        console.log(`Pipe data from python script ...${i++}`); // the python child loops twice for some reason
        outputData = data.toString();
        
        res.end(outputData);
    });
    
    python.on('exit', (code) => {
        
        console.log(`python process exited all stdio with code ${code}`);
        
        // const jarArgs = ["-cp","./jar/uber-STM-1.4-SNAPSHOT.jar", "gov.pnnl.stm.algorithms.STM_NodeArrivalRateMultiType", `-input_file="./csv/metrics.csv"`,
        //         `-separator=","`, "-sampling=false", "-valid_etypes=1", "-delta_limit=false", "-k_top=4", "-max_cores=1", ` -base_out_dir="./item-output/"`]
         
        // const javaJar = spawn("java", jarArgs);
    
        // javaJar.stdout.on('data', (data) => {
        //     console.log(data.toString());
        // });
    
        // javaJar.on("close", (code) => {
        //     console.log(`Jar closed with code ${code}`)
        // });
    
        // javaJar.on("error", (error) => {
        //     console.log(error)
        // });
    });
    
    python.stdout.on("error", (err) => {
        
        console.log(err);
        res.sendStatus(500);
    });

});

app.use(errorHandler);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));