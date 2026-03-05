import React, { useMemo } from "react";
import ReactDom from "react-dom";
import { Modal, Table } from "antd";
import { density, modularity } from "graphology-metrics/graph";
import graphHelper from "../../graph-helper/GraphHelper";
import { UndirectedGraph } from "graphology";

const MetricsModal = ({ open, close }) => {
   const columns = [
      {
         title: "Metric",
         dataIndex: "metric",
         key: "metric",
      },
      {
         title: "Value",
         dataIndex: "value",
         key: "value",
      },
      {
         title: "Description",
         dataIndex: "description",
         key: "description",
      },
   ];

   const metricsData = useMemo(() => {
      if (graphHelper.graph.order === 0) return [];

      return [
         {
            key: "1",
            metric: "Number of Nodes",
            value: graphHelper.graph.order,
            description: "Total number of nodes in the graph.",
         },
         {
            key: "2",
            metric: "Number of Edges",
            value: graphHelper.graph.size,
            description: "Total number of edges in the graph.",
         },
         {
            key: "3",
            metric: "Density",
            value: density(graphHelper.graph).toFixed(4),
            description:
               "A measure of the proportion of actual connections (edges) in a network to the total number of possible connections",
         },
      ];
   });

   return ReactDom.createPortal(
      <Modal centered open={open} footer={[]} title={"Metrics"} onCancel={close}>
         <Table columns={columns} dataSource={metricsData} pagination={false} />
      </Modal>,
      document.getElementById("portal"),
   );
};

export default MetricsModal;
