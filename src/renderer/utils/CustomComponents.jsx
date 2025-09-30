import { styled } from "@mui/system";
import {
   Accordion,
   AccordionDetails,
   AccordionSummary,
   accordionSummaryClasses,
   FormControlLabel,
   Button,
   Switch,
} from "@mui/material";
import { ArrowForwardIosSharp } from "@mui/icons-material";

export const CustomButton = styled(Button)({
   color: "#333333",
   ":hover": { backgroundColor: "#333333", color: "#FFFFFF" },
});

export const CustomSwitch = styled(Switch)({
   "& .MuiSwitch-switchBase": {
      "&.Mui-checked": {
         color: "#45AB48",
         "& + .MuiSwitch-track": {
            backgroundColor: "#45AB48",
         },
      },
   },
});

export const CustomFormControlLabel = styled(FormControlLabel)({
   width: "100%",
   margin: "0",
   padding: "0 1rem",
   justifyContent: "space-between",
});

export const CustomAccordion = styled((props) => (
   <Accordion disableGutters elevation={0} square {...props} />
))(() => ({
   border: `1px solid lightgrey`,
   "&:not(:last-child)": {
      borderBottom: 0,
   },
   "&::before": {
      display: "none",
   },
}));

export const CustomAccordionSummary = styled((props) => (
   <AccordionSummary expandIcon={<ArrowForwardIosSharp sx={{ fontSize: "0.9rem" }} />} {...props} />
))(({ theme }) => ({
   backgroundColor: "rgba(0, 0, 0, .03)",
   flexDirection: "row-reverse",
   [`& .${accordionSummaryClasses.expandIconWrapper}.${accordionSummaryClasses.expanded}`]: {
      transform: "rotate(90deg)",
   },
   [`& .${accordionSummaryClasses.content}`]: {
      marginLeft: theme.spacing(1),
   },
   ...theme.applyStyles("dark", {
      backgroundColor: "rgba(255, 255, 255, .05)",
   }),
}));

export const CustomAccordionDetails = styled(AccordionDetails)(({ theme }) => ({
   padding: theme.spacing(2),
   borderTop: "1px solid rgba(0, 0, 0, .125)",
}));
