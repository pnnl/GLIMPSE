import "../styles/VisToolbar.css";
import { Button, Divider, Space, Tooltip } from "antd";
import graphHelper from "../graph-helper/GraphHelper";
import { BiRotateLeft, BiRotateRight } from "react-icons/bi";
import { IoAddCircle } from "react-icons/io5";
import { MdOutlineHideSource } from "react-icons/md";

const VisToolbar = ({ onToggleLegend }) => {
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
         <Space
            size={2}
            style={{ marginRight: "auto" }}
            separator={<Divider orientation="vertical" />}
         >
            <Tooltip title="Add Overlay" placement="bottomLeft">
               <Button
                  disabled
                  style={{ width: "4rem" }}
                  size="large"
                  type="default"
                  icon={<IoAddCircle size={24} />}
               />
            </Tooltip>
            <Tooltip title="Hide/Show Legend" placement="bottomLeft">
               <Button
                  style={{ width: "4rem" }}
                  size="large"
                  type="default"
                  icon={<MdOutlineHideSource />}
                  onClick={onToggleLegend}
               />
            </Tooltip>
         </Space>
         <Space
            size={2}
            style={{ marginLeft: "auto" }}
            separator={<Divider orientation="vertical" />}
         >
            <Space.Compact block>
               <Tooltip title="Rotate Counter-Clockwise">
                  <Button size="large" onClick={rotateCCW} icon={<BiRotateLeft />} />
               </Tooltip>
               <Tooltip title="Rotate Clockwise">
                  <Button size="large" onClick={rotateCW} icon={<BiRotateRight />} />
               </Tooltip>
            </Space.Compact>

            <Space.Compact block>
               <Button
                  size="large"
                  onClick={goToPrevious}
                  style={{ textTransform: "uppercase" }}
                  type="default"
               >
                  Prev
               </Button>
               <Button
                  size="large"
                  onClick={goToNext}
                  style={{ textTransform: "uppercase" }}
                  type="default"
               >
                  Next
               </Button>
            </Space.Compact>
            <Button
               size="large"
               type="default"
               style={{ textTransform: "uppercase" }}
               onClick={handleReset}
            >
               Reset
            </Button>
         </Space>
      </div>
   );
};

export default VisToolbar;
