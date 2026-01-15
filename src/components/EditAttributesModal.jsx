import ReactDOM from "react-dom";
import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Button, Space, Divider } from "antd";
import graphHelper from "../graphHelper/GraphHelper";

const EditAttributesModal = ({ close, context }) => {
   const [form] = Form.useForm();
   const [attributes, setAttributes] = useState({});
   const { open, object } = context;

   // Initialize form with current attributes when modal opens
   useEffect(() => {
      if (open && object) {
         let currentAttributes = {};

         if (object.type === "node") {
            currentAttributes = graphHelper.graph.getNodeAttribute(object.id, "attributes");
         } else if (object.type === "edge") {
            currentAttributes = graphHelper.graph.getEdgeAttribute(object.id, "attributes");
         }

         setAttributes(currentAttributes);
         form.setFieldsValue(currentAttributes);
      }
   }, [open, object, form]);

   const handleSave = async () => {
      try {
         const values = await form.validateFields();
         console.log(values);

         // Update the graph with new attribute values
         if (object.type === "node") {
            graphHelper.graph.setNodeAttribute(object.id, "attributes", values);
            graphHelper.graph.setNodeAttribute(
               object.id,
               "attributesLabel",
               graphHelper.getTitle(values)
            );
         } else if (object.type === "edge") {
            graphHelper.graph.setEdgeAttribute(object.id, "attributes", values);
         }

         graphHelper.sigmaInstance.refresh();
         close();
      } catch (error) {
         console.error("Validation failed:", error);
      }
   };

   const handleCancel = () => {
      form.resetFields();
      close();
   };

   if (!open || !object) return null;

   return ReactDOM.createPortal(
      <Modal
         open={open}
         title={`Edit ${object.id} Attributes`}
         onCancel={handleCancel}
         styles={{ body: { maxHeight: "60vh", overflowY: "auto" } }}
         footer={[
            <Divider key="divider" />,
            <Button key="cancel" onClick={handleCancel}>
               Cancel
            </Button>,
            <Button key="save" type="primary" onClick={handleSave}>
               Save
            </Button>,
         ]}
      >
         <Form form={form} layout="vertical">
            {object.type === "node" && (
               <>
                  {Object.entries(attributes).map(([attributeName, value], i) => (
                     <Form.Item
                        label={attributeName}
                        name={attributeName}
                        key={i}
                        initialValue={value}
                     >
                        <Input />
                     </Form.Item>
                  ))}
               </>
            )}

            {object.type === "edge" && (
               <>
                  {Object.entries(attributes).map(([attributeName, value], i) => (
                     <Form.Item
                        label={attributeName}
                        name={attributeName}
                        key={i}
                        initialValue={value}
                     >
                        <Input />
                     </Form.Item>
                  ))}
               </>
            )}
         </Form>
      </Modal>,
      document.getElementById("portal")
   );
};

export default EditAttributesModal;
