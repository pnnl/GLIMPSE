const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const corsOptions = require("./config/corsOptions");
const path = require("path");
const bodyParser = require('body-parser');
const fs = require("fs");
const cors = require("cors");
const zip = require("express-easy-zip");
const multer = require('multer');
const errorHandler = require('./middleware/errorHandler');
const { execSync, fork } = require('child_process');
const { logger } = require('./middleware/logEvents');
const jsonSchema =  require("./upload.schema.json");
const Ajv = require('ajv');
const PORT =  process.env.PORT || 3010;

app.use(logger);
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json({ limit: '3mb' }));
app.use(zip());

const storage = multer.diskStorage({
   destination: (req, file, callback) => {
      callback(null, './backend/glmUploads');
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

const rmFolderPaths = (folderPaths) => {

   folderPaths.forEach(( folderPath ) => {  
      fs.rmSync(folderPath, { recursive: true, force: true })
   });
}

// io.on('connection', (socket) => {

//    console.log('a user connected');

//    socket.on("message", (msg) => {
//       socket.broadcast.emit("message", msg);
//    })
// });

app.get("/", (req, res) => {
   res.send({"API": "GLIMPSE"})
})

app.post("/upload", async (req, res) => {
    
   const tempFolderPaths = [
      path.join(__dirname, "glmUploads"),
      path.join(__dirname, "item-output"),
      path.join(__dirname, "emb"),
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
      
      const glm2jsonArgs = `python ./backend/py/glm2json.py ./backend/glmUploads/`;
      execSync(glm2jsonArgs, ( error, stdout, stderr ) => {
   
         if ( error )
         {
            console.error( `exec glm2json error: ${error}` );
            return;
         }
         console.log(stdout.toString());
         console.log(stderr.toString());
      })
   
      const jsonData = JSON.parse(fs.readFileSync('./backend/json/glm2json_output.json'));
      const carryOn = checkIncludes(res, jsonData);
      
      if(carryOn)
      {
         const jarArgs = `java -cp ./backend/jar/uber-STM-1.4-SNAPSHOT.jar gov.pnnl.stm.algorithms.STM_NodeArrivalRateMultiType -input_file="./backend/csv/metrics.csv" -separator="," -sampling=false -valid_etypes=1 -delta_limit=false -k_top=4 -max_cores=1 -base_out_dir="./backend/item-output/"`;
         execSync( jarArgs, ( error, stdout, stderr ) => {
            if ( error )
            {
               console.error( `exec java jar error: ${error}` );
               return;
            }
   
            console.log(stdout.toString());
            console.log(stderr.toString());
         });
      
         const getEmbeddingArgs = `python ./backend/py/STMGetEmbedding.py ./backend/item-output/ ./backend/emb/`;
         execSync(getEmbeddingArgs, (error, stdout, stderr) => {
      
            if ( error )
            {
               console.error( `exec STMgetEmbedding error: ${error}` );
               return;
            }
            console.log(stdout.toString());
            console.log(stderr.toString());
               
         });
      
         const plotArgs = "python ./backend/py/getPCAPlot.py ./backend/emb/node.emb";
         execSync(plotArgs, (error, stdout, stderr) =>
         {
            if( error )
            {
               console.error( `exec error: ${error}` );
               return;
            }
            console.log(stdout.toString());
            console.log(stderr.toString());
         })
         
         rmFolderPaths(tempFolderPaths)
      }
      else 
      {
         rmFolderPaths(tempFolderPaths)
      }

   }
   catch (error) 
   {
      console.log(error);

      rmFolderPaths(tempFolderPaths)
   }

});

app.post("/validate", (req, res) => {
    
   const ajv = new Ajv();
   const validate = ajv.compile(jsonSchema);
   let valid = true;

   for (file of Object.keys(req.body))
   {
      valid = validate(req.body[file]);

      if (!valid) {
         break;
      }
   }

   if (valid)
   {
      res.send({"isValid": true});
   }
   else
   {
      const errorMessage = ajv.errorsText(validate.errors, { dataVar: 'jsonData' });
      console.log(errorMessage);
      res.send({"isValid": false, "error": errorMessage});
   }
})

// https://www.youtube.com/watch?v=7cFNTD73N88 fork example
app.get("/getstats", (req, res) => {

   const child = fork("./backend/processes/getGraphStats.js");
   child.send("start");

   child.on('message', (output) => {
      res.send(output);
   })
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

   Object.keys( jsonGlm ).forEach(( filename ) => {

      fs.writeFileSync( "./backend/json/" + filename, JSON.stringify( jsonGlm[ filename ], null, 3 ), "utf-8" );
   })
   
   fs.readdirSync("./json/").forEach(( filename ) => {

      const json2glmArgs = "json2glm.exe --path-to-file ./json/" + filename + " >> ./backend/glmOutput/" + filename.split( "." )[ 0 ] + ".glm";
      execSync(json2glmArgs, ( error, stdout, stderr ) => {
   
         if( error )
         {
            console.error( `exec error: ${error}` );
            return;
         }
         console.log(stdout.toString());
         console.log(stderr.toString());
      });
      
   });

   res.zip({
      files: [{
         path: "./backend/glmOutput/",
         name: 'glmOutput'
      }],
      filename: 'glmOutput.zip'
   });

   res.on("finish", () => {
      rmFolderPaths(tempFolderPaths)
   })

});

app.get("/getplot", (req, res) => {
   res.sendFile(path.join(__dirname, "figs", "plot.png"));
})

app.get("/simdata", (req, res) => {

   exec("python ./backend/py/mockGridlabd.py", (error, stdout, stderr) => {

      if ( error )
      {
         console.error( `exec mockGridlabd ${error}` );
         return;
      }
      console.log(stdout.toString());
      console.log(stderr.toString());
   })
})

app.use(errorHandler);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));