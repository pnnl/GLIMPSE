import React, { useEffect, useState } from "react";
import { Stack, Typography, Box, Paper, Grid, colors } from "@mui/material";
import Plot from "react-plotly.js";

const chartColors = [
   "#246CAB", // blue
   "#45AB48", // green
   "#333333", // black
];

const Watch = () => {
   const [watchUpdates, setWatchUpdates] = useState(null);
   const [watchData, setWatchData] = useState(null);

   const handleUpdateWatchItem = (updateObj) => {
      if (!watchData) return;

      const csvData =
         typeof updateObj === "string" ? JSON.parse(updateObj)["csv_data"] : updateObj["csv_data"];

      for (let [id, propValues] of Object.entries(watchData)) {
         if (csvData[propValues.adjacentNodeID ?? id].length < propValues.props.length) {
            return null;
         }
      }
      const regex = /[^+-]?\d*\.?\d+/g;
      const dataUpdate = {};

      for (let [id, info] of Object.entries(watchData)) {
         const { props: properties, adjacentNodeID } = info;
         try {
            let watchPropUpdates = properties.reduce((acc, propName, index) => {
               // use the adjacent node id instead of the forward facing id
               const value = csvData[adjacentNodeID ?? id][index + 1];
               const matches = value.match(regex);
               acc[propName] = matches && matches.length > 0 ? matches[0] : value;
               return acc;
            }, {});

            dataUpdate[id] = [
               {
                  timestamp: csvData[adjacentNodeID ?? id][0].split(" ")[1],
                  ...watchPropUpdates,
               },
            ];
         } catch (error) {
            console.log(error);
         }
      }

      if (!watchUpdates) {
         setWatchUpdates(dataUpdate);
      } else {
         setWatchUpdates((prevUpdates) => {
            try {
               const newUpdates = { ...prevUpdates };
               for (const [id, propUpdate] of Object.entries(dataUpdate)) {
                  newUpdates[id] = [...newUpdates[id], ...propUpdate];
               }
               return newUpdates;
            } catch (error) {
               console.log(error);
            }
         });
      }
   };

   useEffect(() => {
      const listners = [];
      listners.push(
         window.glimpseAPI.onShowWatch((watchObject) => {
            setWatchData(watchObject);
         }),
      );
      listners.push(
         window.glimpseAPI.onUpdateWatchItem((update) => {
            console.log(watchData);
            if (watchData) {
               handleUpdateWatchItem(update);
            }
         }),
      );
      return () => {
         listners.forEach((unsub) => unsub());
      };
   });

   return (
      <Box sx={{ height: "100%", width: "100%" }}>
         <Stack direction={"column"}>
            {watchUpdates ? (
               <>
                  {Object.entries(watchUpdates).map(([id, dataProps], index) => {
                     // A chart for each object's property being watched
                     const chartContent = watchData[id].props.map((propName, i) => {
                        // cycle through the 3 colors
                        const color = chartColors[i % chartColors.length];
                        const x = dataProps.map((prop) => prop.timestamp);
                        // property names are like power_out_A, rated_VA, ect...
                        const y = dataProps.map((prop) => prop[propName]);
                        return {
                           title: propName,
                           data: [
                              {
                                 x: x,
                                 y: y,
                                 type: "scatter",
                                 mode: "lines+markers",
                                 name: propName,
                                 line: { color: color, shape: "hv" },
                                 marker: { color: color },
                              },
                           ],
                        };
                     });

                     return (
                        <>
                           <Typography sx={{ m: "1.5rem auto" }} variant="h4">
                              {id}
                           </Typography>
                           <Grid
                              key={index}
                              container
                              spacing={0.5}
                              sx={{
                                 width: "100%",
                                 margin: 0,
                                 flexWrap: "wrap",
                                 justifyContent: "center",
                              }}
                           >
                              {chartContent.length > 0 ? (
                                 chartContent.map((chart, idx) => (
                                    <Grid spacing={{ xs: 12, sm: 6, md: 4 }} key={idx}>
                                       <Paper
                                          elevation={1}
                                          sx={{
                                             width: 550,
                                             height: 450,
                                             minWidth: 400,
                                             minHeight: 300,
                                             maxWidth: 850,
                                             maxHeight: 600,
                                             display: "flex",
                                             alignItems: "center",
                                             justifyContent: "center",
                                             p: "0.5rem 1rem",
                                          }}
                                       >
                                          <Plot
                                             data={chart.data}
                                             layout={{
                                                title: { text: chart.title, font: { size: 18 } },
                                                uirevision: "true",
                                                xaxis: {
                                                   title: { text: "Timestamp" },
                                                   automargin: true,
                                                   autotickangles: true,
                                                   autorange: true,
                                                   angle: -45,
                                                },
                                                autosize: true,
                                                legend: { orientation: "v", y: 0.5, yref: "paper" },
                                             }}
                                             config={{
                                                displaylogo: false,
                                                responsive: true,
                                             }}
                                             style={{ width: "100%", height: "100%" }}
                                          />
                                       </Paper>
                                    </Grid>
                                 ))
                              ) : (
                                 <Grid item spacing={{ xs: 12 }}>
                                    <Typography variant="body1" color="text.secondary">
                                       No chart available for this type.
                                    </Typography>
                                 </Grid>
                              )}
                           </Grid>
                        </>
                     );
                  })}
               </>
            ) : (
               <Typography variant="h5">Waiting for watch data...</Typography>
            )}
         </Stack>
      </Box>
   );
};

export default Watch;
