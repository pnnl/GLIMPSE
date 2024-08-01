import React from "react";
import { Fab, SpeedDial, SpeedDialAction, Stack, Tooltip } from "@mui/material";
import { Adjust, RotateRightSharp, RotateLeftSharp } from "@mui/icons-material";
import { CustomFab } from "../utils/CustomComponents";

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
               icon={<Adjust />}
               sx={{
                  ["& .MuiSpeedDial-fab"]: {
                     backgroundColor: "#333",
                     width: "3rem",
                     height: "3rem",
                     ":hover": { backgroundColor: "#45AB48" },
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
         <CustomFab variant="extended" onClick={prev}>
            Prev
         </CustomFab>
         <CustomFab variant="extended" onClick={next}>
            Next
         </CustomFab>
      </Stack>
   );
};

export default VisActionsDial;
