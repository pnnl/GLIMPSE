const express = require('express');
const app = express();
const { spawn, execSync } = require('child_process');
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

let storage = multer.diskStorage({
    destination: (req, file, callback) => {

        callback(null, './glmUploads');
    },
    filename: (req, file, callback) => {

        callback(null, file.originalname);
    }
});

const upload = multer({storage: storage}).array('glmFile', 4);

const multerUpload = (req, res) => {
    return new Promise((resolve, reject) => {

        upload(req, res, (error) => {
            if (error instanceof multer.MulterError) {
                
                return res.status(500).end("Error uploading files involving multer.");
            }
            else if (error)
            {
                return res.status(500).end("Error uploading files.");
            }
        });

        setTimeout(() => {
          resolve('Done');
        }, 5000);
    });
}

app.post("/upload", async (req, res) => {
    
    fs.mkdirSync(path.join(__dirname, "glmUploads"));
    fs.mkdirSync(path.join(__dirname, "json"));
    fs.mkdirSync(path.join(__dirname, "item-output"));
    fs.mkdirSync(path.join(__dirname, "emb"));

    await multerUpload(req, res);

    const glm2jsonArgs = `python ./py/glm2json.py ./glmUploads/`
    execSync(glm2jsonArgs, ( error ) => {

        if ( error )
        {
            console.error( `exec glm2json error: ${error}` );
            return;
        }

    })

    const data = fs.readFileSync('./json/glm2json_output.json');
    res.send(data)
    
    const jarArgs = `java -cp ./jar/uber-STM-1.4-SNAPSHOT.jar gov.pnnl.stm.algorithms.STM_NodeArrivalRateMultiType -input_file="./csv/metrics.csv" -separator="," -sampling=false -valid_etypes=1 -delta_limit=false -k_top=4 -max_cores=1 -base_out_dir="./item-output/"`;
    execSync( jarArgs, ( error, stdout, stderr) => {
        if ( error )
        {
            console.error( `exec java jar error: ${error}` );
            return;
        }

        console.log(stdout);
        console.log(stderr);
    });

    const getEmbeddingArgs = `python ./py/STMGetEmbedding.py ./item-output/ ./emb/`
    execSync(getEmbeddingArgs, (error) => {

        if ( error )
        {
            console.error( `exec STMgetEmbedding error: ${error}` );
            return;
        }
        
    });

    const plotArgs = "python ./py/getPCAPlot.py ./emb/node.emb"
    execSync(plotArgs, (error) =>
    {
        if( error )
        {
            console.error( `exec error: ${error}` );
            return;
        }
    })

    fs.rmSync(path.join(__dirname, "glmUploads"), { recursive: true, force: true });
    fs.rmSync(path.join(__dirname, "item-output"), { recursive: true, force: true });
    fs.rmSync(path.join(__dirname, "emb"), { recursive: true, force: true });
    fs.rmSync(path.join(__dirname, "json"), { recursive: true, force: true });

});

app.post("/jsontoglm", ( req, res ) => {

    const jsonGlm = req.body;
    const contentLength = req.headers['content-length'];
    console.log(`Incoming JSON payload size: ${contentLength} bytes`);

    fs.mkdirSync(path.join(__dirname, "glmOutput"));

    Object.keys( jsonGlm ).forEach( ( filename ) => {

        fs.writeFileSync( "./json/" + filename, JSON.stringify( jsonGlm[ filename ], null, 3 ),"utf-8" );
    })
    
    fs.readdirSync("./json/").forEach(( filename ) => {

        const json2glmArgs = "json2glm.exe --path-to-file ./json/" + filename + " >> ./glmOutput/" + filename.split( "." )[ 0 ] + ".glm";
        execSync(json2glmArgs, ( error ) => {
    
            if( error )
            {
                console.error( `exec error: ${error}` );
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
        fs.rmSync(path.join(__dirname, "json"),{ recursive: true, force: true });
        fs.rmSync(path.join(__dirname, "glmOutput"),{ recursive: true, force: true });
    })

});

app.get("./getplot", (req, res) => {

    fs.mkdirSync(path.join(__dirname, "figs"));

    const plotArgs = "python ./emb/nodes.emb"
    execSync(plotArgs, (error) =>
    {
        if( error )
        {
            console.error( `exec error: ${error}` );
            return;
        }
    })

})

app.use(errorHandler);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));