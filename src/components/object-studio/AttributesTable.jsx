import React from "react";
import { Table, Typography, Input, Button } from "antd";

const { Link, Text } = Typography;

const UUID_REGEX =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/i;

const AttributesTable = ({
    attributes,
    heading,
    readOnlyAttributes,
    onNavigate,
    onChange,
    onSave,
    feederId,
}) => {
    console.log(attributes);
    const dataSource = attributes
        ? Object.entries(attributes).map(([key, rawValue], index) => {
              let value;
              try {
                  value = JSON.parse(rawValue);
              } catch {
                  value = rawValue;
              }
              return { key: index, attrKey: key, value };
          })
        : [];

    const columns = [
        {
            title: "Attribute",
            dataIndex: "attrKey",
            key: "attrKey",
            width: "30%",
            render: (text) => <Text strong>{text}</Text>,
        },
        {
            title: "Value",
            key: "value",
            render: (_, record) => {
                const { attrKey, value } = record;
                const isReadOnly = readOnlyAttributes.has(attrKey);

                // Empty array
                if (Array.isArray(value) && value.length === 0) {
                    return <Text type="secondary">-</Text>;
                }

                // Array of objects with @id (CIM associations/measurements)
                if (Array.isArray(value) && value.length > 0 && value[0]["@id"]) {
                    return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {value.map((obj, i) => (
                                <Link key={i} onClick={() => onNavigate(obj["@id"], feederId)}>
                                    {obj["@id"]}
                                </Link>
                            ))}
                        </div>
                    );
                }

                // UUID string
                if (typeof value === "string" && UUID_REGEX.test(value)) {
                    if (isReadOnly) {
                        return <Text>{value}</Text>;
                    }
                    return <Link onClick={() => onNavigate(value, feederId)}>{value}</Link>;
                }

                // Object (non-array, non-null)
                if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                    return (
                        <Text style={{ maxWidth: "20rem", display: "inline-block" }}>
                            {value.name ?? JSON.stringify(value)}
                        </Text>
                    );
                }

                // Primitive: read-only or editable
                if (isReadOnly || !onChange) {
                    return <Text>{value != null ? String(value) : "-"}</Text>;
                }

                return (
                    <Input
                        value={value ?? ""}
                        size="small"
                        style={{ maxWidth: "15rem" }}
                        onChange={(e) => onChange(attrKey, e.target.value)}
                    />
                );
            },
        },
    ];

    return (
        <div>
            <div
                style={{
                    backgroundColor: "#777777",
                    color: "#FFFFFF",
                    padding: "0.75rem 1rem",
                    textAlign: "center",
                    fontSize: "1.1rem",
                    fontWeight: 500,
                }}
            >
                {heading}
            </div>
            <Table
                columns={columns}
                dataSource={dataSource}
                pagination={false}
                size="middle"
                rowClassName={(_, index) =>
                    index % 2 === 0 ? "object-table-row-even" : "object-table-row-odd"
                }
            />
            {onSave && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        padding: "1rem",
                    }}
                >
                    <Button type="primary" onClick={onSave}>
                        Save
                    </Button>
                </div>
            )}
        </div>
    );
};

export default AttributesTable;
