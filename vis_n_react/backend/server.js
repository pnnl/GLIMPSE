const express = require('express');
const app = express();
const corsOptions = require("./config/corsOptions");
const path = require("path");
const bodyParser = require('body-parser');
const fs = require("fs");
const cors = require("cors");
const zip = require("express-easy-zip");
const multer = require('multer');
const errorHandler = require('./middleware/errorHandler');
const { execSync } = require('child_process');
const { logger } = require('./middleware/logEvents');
const PORT =  process.env.PORT || 3500;

app.use(logger);

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json({ limit: '3mb' }));
app.use(zip());

const storage = multer.diskStorage({
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
        }, 3500);
    });
}

const checkIncludes = ( res, jsonData ) => {

    let included_files = [];
    let includeS_files = [];
    const missingIncludesRes = {"alert": "One or more include files are missing!"};
    
    Object.keys(jsonData).forEach((fileName) => {

        if (jsonData[fileName]["includes"].length === 0)
        {
            included_files.push(fileName);
        }
        
    });

    Object.keys(jsonData).forEach((fileName) => {

        if (jsonData[fileName]["includes"].length > 0)
        {
            jsonData[fileName]["includes"].forEach((include) => {

                includeS_files.push(include.value.split(".")[0] + ".json");

            });
        }
        
    });

    if(included_files.sort().toString() === includeS_files.sort().toString())
    {
        res.send(jsonData);
        return true;
    }
    else 
    {
        res.end(JSON.stringify(missingIncludesRes));
        return false;
    }

}

app.post("/upload", async (req, res) => {
    
    const tempFolderPaths = [
        path.join(__dirname, "glmUploads"),
        path.join(__dirname, "json"),
        path.join(__dirname, "item-output"),
        path.join(__dirname, "emb")
    ];

    tempFolderPaths.forEach((folderPath) => {

        if(fs.existsSync(folderPath))
        {
            fs.rmSync(folderPath, { recursive: true, force: true });
            fs.mkdirSync(folderPath);
        }
        else
        {
            fs.mkdirSync(folderPath);
        }

    });

    await multerUpload(req, res);

    try {
        
        const glm2jsonArgs = `python ./py/glm2json.py ./glmUploads/`;
        execSync(glm2jsonArgs, ( error ) => {
    
            if ( error )
            {
                console.error( `exec glm2json error: ${error}` );
                return;
            }
    
        })
    
        const jsonData = JSON.parse(fs.readFileSync('./json/glm2json_output.json'));
        const carryOn = checkIncludes(res, jsonData);
        
        if(carryOn)
        {
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
        
            const getEmbeddingArgs = `python ./py/STMGetEmbedding.py ./item-output/ ./emb/`;
            execSync(getEmbeddingArgs, (error) => {
        
                if ( error )
                {
                    console.error( `exec STMgetEmbedding error: ${error}` );
                    return;
                }
                
            });
        
            const plotArgs = "python ./py/getPCAPlot.py ./emb/node.emb";
            execSync(plotArgs, (error) =>
            {
                if( error )
                {
                    console.error( `exec error: ${error}` );
                    return;
                }
            })
            
            tempFolderPaths.forEach(( folderPath ) => {
                
                fs.rmSync(folderPath, { recursive: true, force: true })
        
            });
        }
        else 
        {
            tempFolderPaths.forEach(( folderPath ) => {
                
                fs.rmSync(folderPath, { recursive: true, force: true })
        
            });
        }

    }
    catch (error) 
    {
        console.log(error);

        tempFolderPaths.forEach(( folderPath ) => {
            
            fs.rmSync(folderPath, { recursive: true, force: true })

        });
    }

});

app.post("/jsontoglm", ( req, res ) => {

    const jsonGlm = req.body;
    const contentLength = req.headers['content-length'];
    console.log(`Incoming JSON payload size: ${contentLength} bytes`);

    const tempFolderPaths = [
        path.join(__dirname, "glmOutput"),
        path.join(__dirname, "json")
    ];

    tempFolderPaths.forEach(( folderPath ) => {
        if(fs.existsSync(folderPath))
        {
            fs.rmSync(folderPath, { recursive: true, force: true });
            fs.mkdirSync(folderPath);
        }
        else
        {
            fs.mkdirSync(folderPath);
        }
    })

    Object.keys( jsonGlm ).forEach( ( filename ) => {

        fs.writeFileSync( "./json/" + filename, JSON.stringify( jsonGlm[ filename ], null, 3 ), "utf-8" );
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
        tempFolderPaths.forEach(( folderPath ) => {
            fs.rmSync(folderPath, { recursive: true, force: true });
        })
    })

});

app.get("/getplot", (req, res) => {

    res.sendFile(path.join(__dirname, "figs", "plot.png"));

})

app.use(errorHandler);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));