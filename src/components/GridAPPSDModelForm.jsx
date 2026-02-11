import { useEffect, useState } from "react";
import { Form, Button, Select, Spin } from "antd";
import axios from "axios";

const GridAPPSDModelForm = ({ onModelSelect }) => {
   const [regionNames, setRegionNames] = useState(null);
   const [regionName, setRegionName] = useState(null);
   const [modelInfo, setModelInfo] = useState(false);
   const [connected, setConnected] = useState(false);
   const [loading, setLoading] = useState(false);

   const connectToGridAPPSD = async () => {
      setLoading(true);

      try {
         console.log("Attempting to connect to GridAPPSD...");
         const res = await axios.get("http://127.0.0.1:5051/api/gridappsd/status");

         console.log(res.status);
         console.log(res.data);

         if ("connected" in res.data) {
            setConnected(res.data.connected);
         }
      } catch (e) {
         console.error("Error connecting to GridAPPSD:", e.message);
         console.error("Full error:", e);
      }
   };

   useEffect(() => {
      const getModelInfo = async () => {
         try {
            const modelInfoRequest = axios.get("http://127.0.0.1:5051/api/gridappsd/models");
            const res = await modelInfoRequest;

            if (res.data.error || res.status === 500) {
               console.log(res.data.error);
               setConnected(false);
               return;
            }

            // models is an array
            const models = res.data.models;
            const regionNamesSet = new Set();

            // get set of region names
            models.forEach((model) => regionNamesSet.add(model.regionName));

            setRegionNames(Array.from(regionNamesSet));
            setModelInfo(res.data.models);
         } catch (e) {
            console.error(e);
         } finally {
            setLoading(false);
         }
      };

      if (connected) {
         getModelInfo();
      }
   }, [connected]);

   return (
      <Form>
         {!connected && (
            <Form.Item>
               <Button onClick={connectToGridAPPSD}>Connect</Button>
            </Form.Item>
         )}
         {loading && <Spin />}
         {connected && modelInfo && (
            <>
               <Form.Item label={"Geographical Region Name"}>
                  <Select
                     onChange={(value) => setRegionName(value)}
                     options={regionNames.map((n) => ({ value: n, label: n }))}
                  />
               </Form.Item>
               <Form.Item label={"Model"}>
                  <Select
                     onChange={(value) => onModelSelect(JSON.parse(value))}
                     disabled={regionName === null}
                     options={modelInfo
                        .filter((model) => model.regionName === regionName)
                        .map((model) => ({
                           value: JSON.stringify(model),
                           label: model.modelName,
                        }))}
                  />
               </Form.Item>
            </>
         )}
      </Form>
   );
};

export default GridAPPSDModelForm;
