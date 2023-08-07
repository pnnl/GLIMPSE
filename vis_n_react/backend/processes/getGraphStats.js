const { spawnSync } = require('child_process');

const getGraphStats = () => {

   const child = spawnSync("python", ["./py/nx.py ", "./json/glm2json_output.json"]);
   return child.stdout.toString();
}

process.on('message', (message) => {

   if(message === "start")
   {
      const output = getGraphStats();
      process.send(JSON.parse(output));
   }
})