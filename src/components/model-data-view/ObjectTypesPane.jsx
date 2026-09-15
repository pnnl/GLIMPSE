import { Typography, Collapse, Tag, Divider, Space } from "antd";

const TAG_STYLE = {
    border: "1px solid #d9d9d9",
    borderRadius: 4,
    cursor: "pointer",
    userSelect: "none",
};

// filterTypes is null (show everything) or { nodes?: string[], edges?: string[] }.
const ObjectTypesPane = ({ nodeTypes, edgeTypes, filterTypes, setFilterTypes }) => {
    const toggleFilter = (category, typeName) => {
        setFilterTypes((prev) => {
            const next = { ...prev };
            const current = next[category] ?? [];
            const updated = current.includes(typeName)
                ? current.filter((t) => t !== typeName)
                : [...current, typeName];

            if (updated.length > 0) next[category] = updated;
            else delete next[category];

            return Object.keys(next).length === 0 ? null : next;
        });
    };

    const typeTags = (category, types) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {types.map((type) => (
                <Tag.CheckableTag
                    key={type}
                    checked={Boolean(filterTypes?.[category]?.includes(type))}
                    onChange={() => toggleFilter(category, type)}
                    style={TAG_STYLE}
                >
                    {type}
                </Tag.CheckableTag>
            ))}
        </div>
    );

    const collapseItems = [
        { key: "nodes", label: "Node Types", children: typeTags("nodes", nodeTypes) },
        { key: "edges", label: "Edge Types", children: typeTags("edges", edgeTypes) },
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
