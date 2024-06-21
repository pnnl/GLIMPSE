import React from "react";
import { Fab, SpeedDial, SpeedDialAction, Stack, Tooltip } from "@mui/material";
import { ControlPoint, RotateRightSharp, RotateLeftSharp } from "@mui/icons-material";

const VisActionsDial = ({ rotateCW, rotateCCW, prev, next }) => {
   return (
      <Stack
         alignItems={"center"}
         direction={"row"}
         spacing={1}
         sx={{ position: "absolute", top: "4.4rem", right: 10 }}
      >
         <Tooltip title="Vis Actions" placement="bottom-end">
            <SpeedDial
               direction="left"
               ariaLabel="action-speed-dial"
               icon={<ControlPoint />}
               sx={{
                  ["& .MuiSpeedDial-fab"]: {
                     backgroundColor: "#333",
                     width: "3rem",
                     height: "3rem",
                     ":hover": { backgroundColor: "#B25A00" },
                  },
               }}
            >
               <SpeedDialAction
                  key={"rotatecw"}
                  icon={<RotateRightSharp />}
                  tooltipTitle={"Rotate CW"}
                  placement="bottom"
                  onClick={rotateCW}
               />
               <SpeedDialAction
                  key={"rotateccw"}
                  icon={<RotateLeftSharp />}
                  tooltipTitle={"Rotate CCW"}
                  placement="bottom"
                  onClick={rotateCCW}
               />
            </SpeedDial>
         </Tooltip>
         <Fab
            sx={{
               color: "#FFF",
               border: "1px solid grey",
               backgroundColor: "#333",
               ":hover": { backgroundColor: "#b25a00" },
            }}
            variant="extended"
            onClick={prev}
         >
            Prev
         </Fab>
         <Fab
            sx={{
               color: "#FFF",
               border: "1px solid grey",
               backgroundColor: "#333",
               ":hover": { backgroundColor: "#b25a00" },
            }}
            variant="extended"
            onClick={next}
         >
            Next
         </Fab>
      </Stack>
   );
};

export default VisActionsDial;
