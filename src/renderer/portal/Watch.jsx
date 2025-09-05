import React, { useEffect, useState } from "react";
import { Stack, Typography, Box, Paper, Grid } from "@mui/material";
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
      for (let [id, propValues] of Object.entries(csvData)) {
         console.log(watchData);
         if (propValues.length < watchData[id].props.length) {
            return null;
         }
      }
      const regex = /[^+-]?\d*\.?\d+/g;
      const dataUpdate = {};

      for (let [id, info] of Object.entries(watchData)) {
         const { type, props: properties } = info;
         try {
            let watchPropUpdates = properties.reduce((acc, propName, index) => {
               const value = csvData[id][index + 1];
               const matches = value.match(regex);
               acc[propName] = matches && matches.length > 0 ? matches[0] : value;
               return acc;
            }, {});

            dataUpdate[id] = {
               type: type,
               properties: [
                  {
                     timestamp: csvData[id][0].split(" ")[1],
                     ...watchPropUpdates,
                  },
               ],
            };
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
                  newUpdates[id] = {
                     ...newUpdates[id],
                     properties: [...newUpdates[id].properties, ...propUpdate.properties],
                  };
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
            console.log(watchObject);
            setWatchData(watchObject);
         }),
      );
      listners.push(
         window.glimpseAPI.onUpdateWatchItem((update) => {
            if (watchData) {
               handleUpdateWatchItem(update);
            }
         }),
      );
      return () => {
         listners.forEach((unsub) => unsub());
      };
   });

   // Helper to build plotly traces
   const buildTraces = (labels, dataProps, keys, colors) => {
      try {
         return keys.map((key, idx) => ({
            x: labels,
            y: Object.values(dataProps.properties).map((prop) => prop[key]),
            type: "scatter",
            mode: "lines+markers",
            name: key,
            line: { color: colors[idx % colors.length], shape: "hv" },
            marker: { color: colors[idx % colors.length] },
         }));
      } catch (error) {
         console.log(error);
      }
   };

   return (
      <Box sx={{ height: "100%", width: "100%" }}>
         <Stack direction={"column"}>
            {watchUpdates ? (
               <>
                  {Object.entries(watchUpdates).map(([id, dataProps], index) => {
                     const dataType = dataProps.type;
                     const labels = dataProps.properties.map((prop) => prop.timestamp);
                     let chartContent = [];

                     if (dataType === "switch") {
                        chartContent = [
                           {
                              title: "Current Output",
                              traces: buildTraces(
                                 labels,
                                 dataProps,
                                 ["current_out_A", "current_out_B", "current_out_C"],
                                 chartColors,
                              ),
                           },
                           {
                              title: "Power Output",
                              traces: buildTraces(
                                 labels,
                                 dataProps,
                                 ["power_out_A", "power_out_B", "power_out_C"],
                                 chartColors,
                              ),
                           },
                        ];
                     } else if (dataType === "inverter") {
                        chartContent = [
                           {
                              title: "Power Output",
                              traces: buildTraces(labels, dataProps, ["VA_Out"], [chartColors[0]]),
                           },
                           {
                              title: "Inverter Efficiency",
                              traces: buildTraces(
                                 labels,
                                 dataProps,
                                 ["inverter_efficiency"],
                                 [chartColors[1]],
                              ),
                           },
                           {
                              title: "Rated Power",
                              traces: buildTraces(
                                 labels,
                                 dataProps,
                                 ["rated_power"],
                                 [chartColors[2]],
                              ),
                           },
                        ];
                     } else if (dataType === "diesel_dg") {
                        chartContent = [
                           {
                              title: "Power Output",
                              traces: buildTraces(
                                 labels,
                                 dataProps,
                                 ["power_out_A", "power_out_B", "power_out_C"],
                                 chartColors,
                              ),
                           },
                           {
                              title: "PRef & QRef",
                              traces: buildTraces(
                                 labels,
                                 dataProps,
                                 ["Pref", "Qref"],
                                 [chartColors[0], chartColors[1]],
                              ),
                           },
                        ];
                     }

                     return (
                        <>
                           <Typography sx={{ m: "1.5rem auto" }} variant="h4">
                              {`${id} (${dataType})`}
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
                                             data={chart.traces}
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
