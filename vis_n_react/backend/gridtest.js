const grid = require("./data/123-bus-model/grid.json")
const microGrids = grid.microgrid;

for (const microgrid of microGrids)
{
   console.log(microgrid);
}