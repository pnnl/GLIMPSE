import React, { useMemo, useState, useRef } from "react";
import ReactDOM from "react-dom";
import { Modal, Form, Select, Input, Button } from "antd";
import graphHelper from "../../graph-helper/GraphHelper";

const NewObjectModal = ({ open, close }) => {
   const [formFields, setFormFields] = useState({
      nodeType: "",
      nodeID: "",
      connectTo: "",
      edgeType: "",
   });
   const [form] = Form.useForm();

   const handleSubmit = () => {
      console.log(formFields);
      form.resetFields();
   };

   const handleValuesChange = (changedValue, _) => {
      setFormFields((prev) => ({ ...prev, ...changedValue }));
   };

   const nodesTypes = useMemo(() => {
      if (graphHelper.graph.order === 0) return [];

      return graphHelper.nodeTypes.map((type) => ({
         label: type,
         value: type,
      }));
   }, [graphHelper.graph]);

   const nodeIDs = useMemo(() => {
      // return nothing if there are no nodes in the graph
      if (graphHelper.graph.order === 0) return [];

      return graphHelper.graph.nodes().map((node) => ({
         label: node,
         value: node,
      }));
   }, [graphHelper.graph]);

   const edgeTypes = useMemo(() => {
      if (graphHelper.graph.order === 0) return [];
      return graphHelper.edgeTypes.map((type) => ({
         label: type,
         value: type,
      }));
   }, [graphHelper.graph]);

   const footer = [
      <Button
         key="cancel"
         onClick={() => {
            form.resetFields();
            close();
         }}
      >
         Cancel
      </Button>,
      <Button key="submit" type="primary" onClick={handleSubmit}>
         Submit
      </Button>,
   ];

   return ReactDOM.createPortal(
      <Modal centered open={open} onCancel={close} footer={footer} title="New Node">
         <Form
            form={form}
            labelCol={{ span: 5 }}
            name="new-node"
            autoComplete="off"
            onValuesChange={handleValuesChange}
         >
            <Form.Item label="Node Type" name="nodeType">
               <Select placeholder="type" options={nodesTypes} />
            </Form.Item>
            <Form.Item label="Node ID" name="nodeID">
               <Input placeholder="id" />
            </Form.Item>
            <Form.Item label="Connect To" name="connectTo">
               <Select placeholder="connect to" options={nodeIDs} />
            </Form.Item>
            <Form.Item label="Edge Type" name="edgeType">
               <Select placeholder="edge type" options={edgeTypes} />
            </Form.Item>
         </Form>
      </Modal>,
      document.getElementById("portal"),
   );
};

export default NewObjectModal;
