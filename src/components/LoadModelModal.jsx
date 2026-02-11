import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { Modal, Tabs, Button, Divider } from "antd";
import axios from "axios";
import FileUpload from "./FileUpload";
import GridAPPSDModelForm from "./GridAPPSDModelForm";
import { useGraph } from "../contexts/GraphContext";

const LoadModelModal = ({ onMount }) => {
   const [open, setOpen] = useState(true);
   const [loading, setLoading] = useState(false);
   const [selectedGridappsdModel, setSelectedGridappsdModel] = useState(null);
   const { setGraph } = useGraph();

   const handleModelSelect = (obj) => {
      console.log(obj);
      setSelectedGridappsdModel(obj);
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
      const { modelId } = selectedGridappsdModel;
      try {
         const resPromise = axios.get(`http://127.0.0.1:5051/api/gridappsd/models/${modelId}`);
         const response = await resPromise;
         console.log(response.data);
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
         footer={selectedGridappsdModel ? modalFooter : []}
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
