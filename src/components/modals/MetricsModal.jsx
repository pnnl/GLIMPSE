import React, { useMemo } from "react";
import ReactDom from "react-dom";
import { Modal, Table } from "antd";
import { density } from "graphology-metrics/graph";
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

    // Recomputed each time the modal opens (the graph is a module singleton,
    // so `open` is the signal that fresh metrics are needed). Previously this
    // useMemo had no dependency array at all, which recomputed every render.
    const metricsData = useMemo(() => {
        if (!open || graphHelper.graph.order === 0) return [];

        const graph = graphHelper.graph;

        let totalDegree = 0;
        let maxDegree = 0;
        let minDegree = Infinity;
        let isolatedCount = 0;

        graph.forEachNode((node) => {
            const deg = graph.degree(node);
            totalDegree += deg;
            if (deg > maxDegree) maxDegree = deg;
            if (deg < minDegree) minDegree = deg;
            if (deg === 0) isolatedCount++;
        });

        const avgDegree = totalDegree / graph.order;
        if (minDegree === Infinity) minDegree = 0;

        return [
            {
                key: "1",
                metric: "Number of Nodes",
                value: graph.order,
                description: "Total number of nodes in the graph.",
            },
            {
                key: "2",
                metric: "Number of Edges",
                value: graph.size,
                description: "Total number of edges in the graph.",
            },
            {
                key: "3",
                metric: "Density",
                value: density(graph).toFixed(4),
                description:
                    "Proportion of actual connections to the maximum possible connections in the graph.",
            },
            {
                key: "4",
                metric: "Average Degree",
                value: avgDegree.toFixed(2),
                description: "Average number of connections per node.",
            },
            {
                key: "5",
                metric: "Max Degree",
                value: maxDegree,
                description: "Highest number of connections belonging to a single node.",
            },
            {
                key: "6",
                metric: "Min Degree",
                value: minDegree,
                description: "Lowest number of connections belonging to a single node.",
            },
            {
                key: "7",
                metric: "Isolated Nodes",
                value: isolatedCount,
                description: "Number of nodes with no connections (degree 0).",
            },
            {
                key: "8",
                metric: "Self-Loops",
                value: graph.selfLoopCount,
                description: "Number of edges that connect a node to itself.",
            },
        ];
    }, [open]);

    return ReactDom.createPortal(
        <Modal centered open={open} footer={[]} title={"Metrics"} onCancel={close}>
            <Table columns={columns} dataSource={metricsData} pagination={false} />
        </Modal>,
        document.getElementById("portal"),
    );
};

export default MetricsModal;
