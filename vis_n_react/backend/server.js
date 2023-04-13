const express = require('express');
const app = express();
const { spawn, exec, execSync } = require('child_process');
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require('multer');
const zip = require("express-easy-zip");
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
app.use(bodyParser.json({ limit: '3mb' }));
app.use(zip());

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

    fs.mkdirSync(path.join(__dirname, "glmUploads"));

    fs.existsSync(path.join(__dirname, "glmUploads"), (exists) => {
        console.log(exists ? "glmUploads folder exits" : "glmUploads folder does not exits")
    })

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
        fs.rmdirSync(path.join(__dirname, "glmUploads"));
    });
    
    glm2json_py.stdout.on("error", (err) => {
        
        console.log(err);
        res.sendStatus(500);
    });

});

app.post("/jsontoglm", ( req, res ) => {

    let jsonGlm = req.body;
    const contentLength = req.headers['content-length'];
    console.log(`Incoming JSON payload size: ${contentLength} bytes`);

    fs.mkdirSync(path.join(__dirname, "json"));
    fs.mkdirSync(path.join(__dirname, "glmOutput"));

    Object.keys( jsonGlm ).forEach( ( filename ) => {

        fs.writeFileSync( "./json/" + filename, JSON.stringify( jsonGlm[ filename ], null, 3 ),"utf-8" );
    })
    
    fs.readdirSync("./json/").forEach(( filename ) => {

        let json2glmArgs = "json2glm.exe --path-to-file ./json/" + filename + " >> ./glmOutput/" + filename.split( "." )[ 0 ] + ".glm";
        execSync(json2glmArgs, ( error ) => {
    
            if( error )
            {
                console.error( `exec error: ${error}` )
                return;
            }

        });
        
    });

    res.zip({
        files: [{
            path: "./glmOutput/",
            name: 'glmOutput'
        }],
        filename: 'glmOutput.zip'
    });

    res.on("finish", () => {
        fs.rmdirSync(path.join(__dirname, "json"),{ recursive: true, force: true });
        fs.rmdirSync(path.join(__dirname, "glmOutput"),{ recursive: true, force: true });
    })

  
});

app.use(errorHandler);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));