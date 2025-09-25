import React from "react";
import mermaid from "mermaid";
import { Box, Paper } from "@mui/material";

const MermaidDiagram = ({ mermaidContent, objectID }) => {
   const mermaidContainerRef = React.useRef(null);

   const renderMermaid = async () => {
      mermaidContainerRef.current.innerHTML = "";

      const elementID = `mermaid-${Date.now()}`;

      try {
         console.log(mermaidContent);
         const mermaidDiagram = await mermaid.render(elementID, mermaidContent);
         mermaidContainerRef.current.innerHTML = mermaidDiagram.svg;
      } catch (error) {
         console.log(error);
      }
   };

   React.useEffect(() => {
      // Initialize with specific theme and overrides
      mermaid.initialize({
         startOnLoad: true,
         theme: "default",
         securityLevel: "loose"
      });

      renderMermaid();
   }, [mermaidContent, objectID]); // Only re-render when content or ID changes

   return (
      <Box
         component={Paper}
         elevation={0}
         sx={{
            maxWidth: "100%",
            maxHeight: "calc(100% - 6rem)",
            overflow: "auto",
            padding: "0.5rem"
         }}
      >
         <div
            ref={mermaidContainerRef}
            style={{
               textAlign: "center",
               border: "1px solid #d9d9d9",
               borderRadius: "0.375rem",
               backgroundColor: "#FFFFFF",
               minHeight: "12.5rem",
               overflow: "auto"
            }}
         />
      </Box>
   );
};

export default MermaidDiagram;
