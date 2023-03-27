const express = require('express');
const app = express();
const { spawn, exec } = require('child_process');
const fs = require("fs");
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
app.use(bodyParser.json());

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
    
    const glm2json_py = spawn('python', ['./py/glm2json.py', './glmUploads/']);

    glm2json_py.stdout.on('data', (data) => {
        
        console.log(`Pipe data from python script ...${i++}`); // the python child loops twice for some reason
        outputData = data.toString();
        
        res.end(outputData);
    });
    
    glm2json_py.on('exit', (code) => {
        
        console.log(`python process exited all stdio with code ${code}`);
    });
    
    glm2json_py.stdout.on("error", (err) => {
        
        console.log(err);
        res.sendStatus(500);
    });
    

    // let jarArgs = `java -cp ./jar/uber-STM-1.4-SNAPSHOT.jar gov.pnnl.stm.algorithms.STM_NodeArrivalRateMultiType -input_file="./csv/metrics.csv" -separator="," -sampling=false -valid_etypes=1 -delta_limit=false -k_top=4 -max_cores=1 -base_out_dir="./item-output/"`;
    // exec(jarArgs, (error, stdout, stderr) => {
        
    //     if(error)
    //     {
    //         console.error(`exec error: ${error}`)
    //         return;
    //     }
    //     console.log(`stdout: ${stdout}`);
    //     console.log(`stderr: ${stderr}`);

    // });

    // const STMGetEmbedding_py = spawn("python", ["./py/STMGetEmbedding.py", "./item-output/", "./emb/"]);
    
    // STMGetEmbedding_py.stdout.on("data", (data) => {
        
    //     console.log(`Pipe data from python script..............`);
    //     console.log(data.toString());
        
    // })
    
    // STMGetEmbedding_py.on('exit', (code) => {
        
    //     console.log(`python process exited all stdio with code ${code}`);
        
    // });
    
    // STMGetEmbedding_py.stdout.on("error", (err) => {
        
    //     console.log(err);
        
    // });

});

app.post("/jsontoglm", (req, res) => {

    let jsonglm = req.body;

    Object.keys(jsonglm).forEach((filename) => {
        try 
        {
            fs.writeFileSync("./json/" + filename, JSON.stringify(jsonglm[filename], null, 3), 'utf8');
        } 
        catch (error) 
        {
            console.log('An error has occurred ', error);
        }
    })

    fs.readdirSync("./json/").forEach((filename) => {

        let json2glmArgs = "json2glm.exe --path-to-file ./json/" + filename + " >> ./glmOutput/" + filename.split(".")[0] + ".glm";

        console.log(json2glmArgs);

        exec(json2glmArgs, (error) => {

            if(error)
            {
                console.error(`exec error: ${error}`)
                return;
            }

        });

    });

    res.send("JSON was received");
})

app.use(errorHandler);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));