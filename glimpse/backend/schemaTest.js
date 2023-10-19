const Ajv = require("ajv");
const jsonSchema =  require("./upload.schema.json");
const model = require("./data/topologyMap.json");

const ajv = new Ajv();
const validate = ajv.compile(jsonSchema);

if (validate(model))
{
   console.log('The JSON data is valid according to the schema.');
}
else
{
   const errorMessage = ajv.errorsText(validate.errors, { dataVar: 'jsonData' });
   console.log('The JSON data is NOT valid according to the schema.');
   console.log(errorMessage);
}