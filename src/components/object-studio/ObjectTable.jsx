import React from "react";
import { Table, Typography } from "antd";
import graphHelper from "../../graph-helper/GraphHelper";
import { useGraph } from "../../contexts/GraphContext";

const { Link } = Typography;

const ObjectTable = ({ data, columns, onEditObject, isCIM }) => {
    const { darkMode } = useGraph();
    const handleObjectClick = (record) => {
        if (isCIM) {
            onEditObject({
                mRID: record.attributes.mRID,
                feederId: record.attributes.feeder_id,
            });
        } else {
            onEditObject({ id: record.id });
        }
    };

    const handleFromToClick = (nodeId) => {
        if (!graphHelper.graph.hasNode(nodeId)) return;
        const nodeAttrs = graphHelper.graph.getNodeAttributes(nodeId);
        if (isCIM) {
            onEditObject({
                mRID: nodeAttrs.attributes?.mRID,
                feederId: nodeAttrs.attributes?.feeder_id,
            });
        } else {
            onEditObject({ type: "node", id: nodeId });
        }
    };

    const tableColumns = columns.map((colName) => {
        if (colName === "type") {
            return {
                title: colName,
                key: colName,
                fixed: "left",
                width: 120,
                onCell: (_, index) => ({
                    style: {
                        backgroundColor:
                            index % 2 === 0
                                ? darkMode
                                    ? "#1f1f1f"
                                    : "#ffffff"
                                : darkMode
                                  ? "#2a2a2a"
                                  : "#fafafa",
                    },
                }),
                render: (_, record) => <Typography.Text strong>{record.group}</Typography.Text>,
            };
        }

        if (colName === "from" || colName === "to") {
            return {
                title: colName,
                key: colName,
                width: 100,
                render: (_, record) => {
                    const nodeId = record.attributes?.[colName];
                    if (!nodeId) return "-";
                    if (!graphHelper.graph.hasNode(nodeId)) return String(nodeId);
                    const nodeAttrs = graphHelper.graph.getNodeAttributes(nodeId);
                    return (
                        <Link onClick={() => handleFromToClick(nodeId)}>
                            {nodeAttrs.attributes?.name ?? nodeId}
                        </Link>
                    );
                },
            };
        }

        if (colName === "id") {
            return {
                title: colName,
                key: colName,
                width: 200,
                sorter: (a, b) => {
                    const aVal = String(a.attributes?.id ?? a.id);
                    const bVal = String(b.attributes?.id ?? b.id);
                    return aVal.localeCompare(bVal);
                },
                render: (_, record) => {
                    const value = record.attributes?.id ?? record.id;
                    return <Link onClick={() => handleObjectClick(record)}>{value}</Link>;
                },
            };
        }

        if (colName === "name") {
            return {
                title: colName,
                key: colName,
                width: 120,
                sorter: (a, b) => {
                    const aVal = String(a.attributes?.name ?? "");
                    const bVal = String(b.attributes?.name ?? "");
                    return aVal.localeCompare(bVal);
                },
                render: (_, record) => {
                    const value = record.attributes.name;
                    if (!value) return "-";
                    return <Link onClick={() => handleObjectClick(record)}>{value}</Link>;
                },
            };
        }

        return {
            title: colName,
            key: colName,
            ellipsis: true,
            sorter: (a, b) => {
                const aVal = String(a.attributes?.[colName] ?? "");
                const bVal = String(b.attributes?.[colName] ?? "");
                return aVal.localeCompare(bVal);
            },
            render: (_, record) => {
                const value = record.attributes[colName];
                if (value == null || value === "") return "-";
                if (typeof value === "object") {
                    return (
                        <Typography.Text ellipsis={true} style={{ maxWidth: "15rem" }}>
                            {value.name ?? JSON.stringify(value)}
                        </Typography.Text>
                    );
                }
                return String(value);
            },
        };
    });

    return (
        <Table
            columns={tableColumns}
            dataSource={data}
            rowKey="id"
            size="small"
            sticky
            rowClassName={(_, index) =>
                index % 2 === 0 ? "object-table-row-even" : "object-table-row-odd"
            }
            pagination={{
                defaultPageSize: 25,
                pageSizeOptions: [25, 50, 100],
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
            }}
            scroll={{ x: "max-content", y: "calc(100vh - 15.5rem)" }}
        />
    );
};

export default ObjectTable;
