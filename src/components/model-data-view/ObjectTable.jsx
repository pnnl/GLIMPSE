import React from "react";
import { Table, Typography, Button } from "antd";
import { ControlOutlined } from "@ant-design/icons";
import graphHelper from "../../graph-helper/GraphHelper";
import { formatVoltageLines, formatPowerLines } from "../../utils/live-measurements";
import { formatAmps, formatPercent, formatPu, formatVA, isViolation } from "../../utils/electrical";

const { Link, Text } = Typography;

// A per-unit voltage or percent-loading cell, colored by severity so a table
// sorted by loading reads like a violation report.
const SeverityValue = ({ value, severity, sub }) => {
    if (value == null) return <Text type="secondary">-</Text>;
    return (
        <div style={{ lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>
            <span
                style={{
                    color: severity?.color,
                    fontWeight: isViolation(severity) ? 600 : 400,
                    whiteSpace: "nowrap",
                }}
            >
                {value}
            </span>
            {sub && (
                <div style={{ fontSize: 11, opacity: 0.65, whiteSpace: "nowrap" }}>{sub}</div>
            )}
        </div>
    );
};

// Renders a stack of per-phase live-measurement lines (or a dash when the row
// has no measurement yet this tick).
const LiveLines = ({ lines }) => {
    if (!lines || lines.length === 0) return <Text type="secondary">-</Text>;
    return (
        <div style={{ lineHeight: 1.3 }}>
            {lines.map((line, i) => (
                <div key={i} style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {line}
                </div>
            ))}
        </div>
    );
};

/**
 * Detects whether a table row is a device that can be controlled during a live
 * GridAPPS-D simulation. Switches (open/close) and regulators (tap positions)
 * are edges; capacitors (open/close) are nodes. Mirrors the double-click
 * detection in GraphEvents so the tabular view and the graph stay in sync.
 */
const getControlType = (record, elementType) => {
    const group = record.group;
    const classType = record.attributes?.class_type;
    if (elementType === "edge") {
        if (group === "regulator" || classType === "regulator") return "regulator";
        if (group === "switch") return "switch";
    } else if (elementType === "node") {
        if (group === "capacitor") return "capacitor";
    }
    return null;
};

const ObjectTable = ({
    data,
    columns,
    onEditObject,
    onControlObject,
    isCIM,
    elementType,
    simActive = false,
}) => {
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

    // Trailing fixed-right columns, kept visible while the attribute columns
    // scroll: a live-measurement column (during a simulation) and the device
    // control column (CIM/GridAPPS-D models only).
    const trailingColumns = [];

    // Condition columns: worst-phase p.u. voltage for nodes, percent loading for
    // edges. Sortable, so "show me the worst 25 buses" is one click. Placed
    // before the raw measurement column since it's the summarizing number.
    if (simActive) {
        trailingColumns.push(
            elementType === "node"
                ? {
                      title: "V (p.u.)",
                      key: "__pu",
                      fixed: "right",
                      width: 110,
                      // Ascending puts the deepest undervoltage first.
                      sorter: (a, b) => {
                          const pa = graphHelper.getNodeVoltageSummary(a.id)?.worst.pu ?? Infinity;
                          const pb = graphHelper.getNodeVoltageSummary(b.id)?.worst.pu ?? Infinity;
                          return pa - pb;
                      },
                      render: (_, record) => {
                          const summary = graphHelper.getNodeVoltageSummary(record.id);
                          if (!summary) return <Text type="secondary">-</Text>;
                          return (
                              <SeverityValue
                                  value={formatPu(summary.worst.pu)}
                                  severity={summary.worst.severity}
                                  sub={`worst: ${summary.worst.phase}`}
                              />
                          );
                      },
                  }
                : {
                      title: "loading",
                      key: "__loading",
                      fixed: "right",
                      width: 120,
                      // Descending puts the most heavily loaded first.
                      sorter: (a, b) => {
                          const ra = graphHelper.getEdgeLoadingSummary(a.id)?.ratio ?? -1;
                          const rb = graphHelper.getEdgeLoadingSummary(b.id)?.ratio ?? -1;
                          return ra - rb;
                      },
                      render: (_, record) => {
                          const summary = graphHelper.getEdgeLoadingSummary(record.id);
                          if (!summary) return <Text type="secondary">-</Text>;
                          if (summary.worst == null) {
                              // Measured, but no ampere rating (or no voltage to
                              // convert power into current) — show the flow only.
                              return (
                                  <SeverityValue
                                      value={formatVA(summary.apparent)}
                                      sub={summary.normalLimit == null ? "no rating" : "no base voltage"}
                                  />
                              );
                          }
                          return (
                              <SeverityValue
                                  value={formatPercent(summary.ratio)}
                                  severity={summary.severity}
                                  sub={`${formatAmps(summary.worst.amps)} / ${formatAmps(summary.normalLimit)}`}
                              />
                          );
                      },
                  },
        );
    }

    // Live voltage (nodes) / power flow (edges) from the simulation overlay.
    // Read-only and ephemeral — the model's own attributes are never touched.
    if (simActive) {
        trailingColumns.push(
            elementType === "node"
                ? {
                      title: "voltage (live)",
                      key: "__voltage",
                      fixed: "right",
                      width: 150,
                      render: (_, record) => (
                          <LiveLines
                              lines={formatVoltageLines(
                                  graphHelper.liveMeasurements.nodes.get(record.id)?.voltage,
                              )}
                          />
                      ),
                  }
                : {
                      title: "power flow (live)",
                      key: "__power",
                      fixed: "right",
                      width: 190,
                      render: (_, record) => (
                          <LiveLines
                              lines={formatPowerLines(
                                  graphHelper.liveMeasurements.edges.get(record.id)?.power,
                              )}
                          />
                      ),
                  },
        );
    }

    if (isCIM && onControlObject) {
        trailingColumns.push({
            title: "control",
            key: "__control",
            fixed: "right",
            width: 120,
            render: (_, record) => {
                const controlType = getControlType(record, elementType);
                if (!controlType) return null;
                return (
                    <Button
                        size="small"
                        icon={<ControlOutlined />}
                        onClick={() => onControlObject(record, controlType)}
                    >
                        Control
                    </Button>
                );
            },
        });
    }

    const columnsWithActions =
        trailingColumns.length > 0 ? [...tableColumns, ...trailingColumns] : tableColumns;

    return (
        <Table
            columns={columnsWithActions}
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
