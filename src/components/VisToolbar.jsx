import "../styles/VisToolbar.css";
import { Button, Divider, Space, Tooltip, Switch } from "antd";
import graphHelper from "../graphHelper/GraphHelper";
import { BiRotateLeft, BiRotateRight } from "react-icons/bi";
import { CameraControls } from "./CameraControls";

const VisToolbar = () => {
   const rotateCCW = () => {
      graphHelper.rotateCCW();
      graphHelper.sigmaInstance.refresh();
   };

   const rotateCW = () => {
      graphHelper.rotateCW();
      graphHelper.sigmaInstance.refresh();
   };

   const unHighlightCurrent = (obj) => {
      if (obj.type === "edge") {
         graphHelper.graph.setEdgeAttribute(obj.id, "highlighted", false);
      } else {
         graphHelper.graph.setNodeAttribute(obj.id, "highlighted", false);
      }
   };

   const goToPrevious = () => {
      if (graphHelper.highlightedObjects.length === 0) return;

      if (graphHelper.getCurrentHighlightedObject()) {
         unHighlightCurrent(graphHelper.getCurrentHighlightedObject());
      }

      graphHelper.focus(graphHelper.getPrevious());
   };

   const goToNext = () => {
      if (graphHelper.highlightedObjects.length === 0) return;

      if (graphHelper.getCurrentHighlightedObject()) {
         unHighlightCurrent(graphHelper.getCurrentHighlightedObject());
      }

      graphHelper.focus(graphHelper.getNext());
   };

   const handleReset = () => {
      if (graphHelper.highlightedObjects.length === 0) return;

      if (graphHelper.getCurrentHighlightedObject()) {
         unHighlightCurrent(graphHelper.getCurrentHighlightedObject());
      }

      graphHelper.reset();
      graphHelper.sigmaInstance.refresh();
   };

   return (
      <div className="vis-toolbar">
         <Space size={2} style={{ marginLeft: "auto" }} split={<Divider type="vertical" />}>
            <Space.Compact block>
               <Tooltip title="Rotate Counter-Clockwise">
                  <Button onClick={rotateCCW} icon={<BiRotateLeft size={"1.375rem"} />} />
               </Tooltip>
               <Tooltip title="Rotate Clockwise">
                  <Button onClick={rotateCW} icon={<BiRotateRight size={"1.375rem"} />} />
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
