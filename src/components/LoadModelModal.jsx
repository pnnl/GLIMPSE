import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { Modal, Tabs, Button, Divider } from "antd";
import axios from "axios";
import FileUpload from "./FileUpload";
import GridAPPSDModelForm from "./GridAPPSDModelForm";
import graphHelper from "../graph-helper/GraphHelper";
import { useGraph } from "../contexts/GraphContext";

const LoadModelModal = ({ onMount }) => {
   const [open, setOpen] = useState(true);
   const [loading, setLoading] = useState(false);
   const [selectedGridappsdModels, setSelectedGridappsdModels] = useState(null);
   const { newGraphUpdate } = useGraph();

   const handleModelSelect = (obj) => {
      console.log(obj);
      setSelectedGridappsdModels(obj);
   };

   const ITEMS = [
      {
         label: "File Upload",
         key: "file-upload",
         children: <FileUpload closeModal={() => setOpen(false)} />,
      },
      {
         label: "Load w/ GridAPPS-D",
         key: "load-gridappsd",
         children: <GridAPPSDModelForm onModelSelect={handleModelSelect} />,
      },
   ];

   useEffect(() => {
      if (onMount) {
         onMount(setOpen);
      }
   }, [onMount]);

   const close = () => setOpen(false);

   const handleLoad = async () => {
      setLoading(true);

      try {
         const resPromise = axios.post(
            `http://127.0.0.1:5051/api/gridappsd/models`,
            selectedGridappsdModels,
            {
               headers: { "Content-Type": "application/json" },
            },
         );
         const response = await resPromise;

         console.log(response.data);
         if ("error" in response.data) throw new Error(response.data.error);

         // Set graph data which triggers clear and render
         if (graphHelper.graph.order > 0) {
            graphHelper.clearGraphData();

            window.dispatchEvent(new CustomEvent("graph-cleared"));

            graphHelper.setGraphData(response.data);
            newGraphUpdate();
         } else {
            graphHelper.setGraphData(response.data);
            newGraphUpdate();
         }

         window.dispatchEvent(new CustomEvent("graph-loaded"));

         // Close modal after data is set
         setOpen(false);
      } catch (e) {
         console.log(e);
      } finally {
         setLoading(false);
      }
   };

   const modalFooter = [
      <Button key={"load-btn"} loading={loading} onClick={handleLoad}>
         Load
      </Button>,
   ];

   return createPortal(
      <Modal
         centered
         footer={selectedGridappsdModels ? modalFooter : []}
         width={750}
         title="Load a Model"
         onCancel={close}
         open={open}
      >
         <Tabs type="card" items={ITEMS} />
      </Modal>,
      document.getElementById("portal"),
   );
};

export default LoadModelModal;
