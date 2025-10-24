import "../styles/VisToolbar.css";
import { Button, Divider, Space, Tooltip } from "antd";
import graphHelper from "../graphHelper/GraphHelper";
import { BiRotateLeft, BiRotateRight } from "react-icons/bi";

const VisToolbar = () => {
   const rotateCCW = () => {
      graphHelper.rotateCCW();
      graphHelper.sigmaInstance.refresh();
   };

   const focus = (nodeID) => {
      console.log("Focusing on node: " + nodeID);
      graphHelper.graph.setNodeAttribute(nodeID, "highlighted", true);
      const nodeDisplayData = graphHelper.sigmaInstance.getNodeDisplayData(nodeID);

      if (nodeDisplayData) {
         graphHelper.sigmaInstance.getCamera().animate(
            { ...nodeDisplayData, ratio: 0.05 },
            {
               duration: 600,
            }
         );
      }
   };

   const rotateCW = () => {
      graphHelper.rotateCW();
      graphHelper.sigmaInstance.refresh();
   };

   const goToPrevious = () => {
      if (graphHelper.getCurrentHighlightedObject()) {
         graphHelper.graph.setNodeAttribute(
            graphHelper.getCurrentHighlightedObject(),
            "highlighted",
            false
         );

         focus(graphHelper.getPrevious());
         graphHelper.sigmaInstance.refresh();
      }
   };

   const goToNext = () => {
      if (graphHelper.highlightedObjects.length === 0) return;

      if (graphHelper.getCurrentHighlightedObject()) {
         graphHelper.graph.setNodeAttribute(
            graphHelper.getCurrentHighlightedObject(),
            "highlighted",
            false
         );
      }

      focus(graphHelper.getNext());
      graphHelper.sigmaInstance.refresh();
   };

   const handleReset = () => {
      if (graphHelper.highlightedObjects.length === 0) return;

      if (graphHelper.getCurrentHighlightedObject()) {
         graphHelper.graph.setNodeAttribute(
            graphHelper.getCurrentHighlightedObject(),
            "highlighted",
            false
         );
      }
      graphHelper.reset();
      graphHelper.sigmaInstance.refresh();
   };

   return (
      <div className="vis-toolbar">
         <Space size={2} style={{ marginLeft: "auto" }} split={<Divider type="vertical" />}>
            <Space.Compact block>
               <Tooltip title="Rotate Counter-Clockwise">
                  <Button onClick={rotateCCW} icon={<BiRotateLeft />} />
               </Tooltip>
               <Tooltip title="Rotate Clockwise">
                  <Button onClick={rotateCW} icon={<BiRotateRight />} />
               </Tooltip>
            </Space.Compact>

            <Space.Compact block>
               <Button onClick={goToPrevious} style={{ textTransform: "uppercase" }} type="default">
                  Prev
               </Button>
               <Button onClick={goToNext} style={{ textTransform: "uppercase" }} type="default">
                  Next
               </Button>
            </Space.Compact>
            <Button type="default" style={{ textTransform: "uppercase" }} onClick={handleReset}>
               Reset
            </Button>
         </Space>
      </div>
   );
};

export default VisToolbar;
