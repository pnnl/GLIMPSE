import React from "react";
import { Typography, Collapse, Tag, Divider, Space } from "antd";

const ObjectTypesPane = ({ nodeTypes, edgeTypes, filterTypes, setFilterTypes }) => {
    const handleFilterClick = (category, typeName) => {
        setFilterTypes((prev) => {
            // Clone or start fresh
            const next = prev ? { ...prev } : {};

            if (next[category]) {
                if (next[category].includes(typeName)) {
                    // Remove this type
                    next[category] = next[category].filter((t) => t !== typeName);
                    // If no types left in this category, remove the key entirely
                    if (next[category].length === 0) {
                        delete next[category];
                    }
                } else {
                    next[category] = [...next[category], typeName];
                }
            } else {
                next[category] = [typeName];
            }

            // If both categories are gone, return null (show everything)
            return Object.keys(next).length === 0 ? null : next;
        });
    };

    const isActive = (category, typeName) => {
        return filterTypes && category in filterTypes && filterTypes[category].includes(typeName);
    };

    const collapseItems = [
        {
            key: "nodes",
            label: "Node Types",
            children: (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {nodeTypes.map((ntype) => (
                        <Tag.CheckableTag
                            key={ntype}
                            checked={isActive("nodes", ntype)}
                            onChange={() => handleFilterClick("nodes", ntype)}
                            style={{
                                border: "1px solid #d9d9d9",
                                borderRadius: 4,
                                cursor: "pointer",
                                userSelect: "none",
                            }}
                        >
                            {ntype}
                        </Tag.CheckableTag>
                    ))}
                </div>
            ),
        },
        {
            key: "edges",
            label: "Edge Types",
            children: (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {edgeTypes.map((etype) => (
                        <Tag.CheckableTag
                            key={etype}
                            checked={isActive("edges", etype)}
                            onChange={() => handleFilterClick("edges", etype)}
                            style={{
                                border: "1px solid #d9d9d9",
                                borderRadius: 4,
                                cursor: "pointer",
                                userSelect: "none",
                            }}
                        >
                            {etype}
                        </Tag.CheckableTag>
                    ))}
                </div>
            ),
        },
    ];

    return (
        <Space orientation="vertical" separator={<Divider style={{ margin: 0 }} />}>
            <Typography.Title level={5} style={{ textAlign: "center", margin: "1rem 0" }}>
                Object Types
            </Typography.Title>
            <Collapse defaultActiveKey={["nodes", "edges"]} ghost items={collapseItems} />
        </Space>
    );
};

export default ObjectTypesPane;
