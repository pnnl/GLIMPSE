import { Typography, theme } from "antd";
import graphHelper from "../graph-helper/GraphHelper";

// Read once per mount: the SigmaContainer remounts whenever a new model loads.
const ModelNameBadge = () => {
    const { token } = theme.useToken();
    const names = graphHelper.modelNames;

    if (!names.length) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, marginBottom: 4 }}>
            {names.map((name) => (
                <Typography.Text
                    key={name}
                    title={name}
                    style={{
                        fontSize: 12,
                        padding: "3px 10px",
                        background: token.colorBgContainer,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 6,
                        boxShadow: token.boxShadowTertiary,
                        whiteSpace: "nowrap",
                    }}
                >
                    {name.replace(/\.[^.]+$/, "")}
                </Typography.Text>
            ))}
        </div>
    );
};

export default ModelNameBadge;
