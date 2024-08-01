import { styled } from "@mui/system";
import { Button, Fab } from "@mui/material";

export const CustomButton = styled(Button)({
   color: "#333333",
   ":hover": { backgroundColor: "#333333", color: "#FFFFFF" },
});

export const CustomFab = styled(Fab)({
   color: "#FFF",
   border: "1px solid grey",
   backgroundColor: "#333",
   ":hover": { backgroundColor: "#45AB48" },
});
