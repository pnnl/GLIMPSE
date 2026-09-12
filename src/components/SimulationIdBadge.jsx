import { useEffect, useState } from "react";
import { Typography, theme } from "antd";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";

const SimulationIdBadge = () => {
    const { token } = theme.useToken();
    const [simulationID, setSimulationID] = useState(() => socketClientHelper.simulationID);

    useEffect(() => {
        return socketClientHelper.on("sim-state-change", () => {
            setSimulationID(socketClientHelper.simulationID);
        });
    }, []);

    if (!simulationID) return null;

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 10px",
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 6,
                boxShadow: token.boxShadowTertiary,
                whiteSpace: "nowrap",
            }}
        >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Simulation ID:
            </Typography.Text>
            <Typography.Text
                copyable={{ tooltips: ["Copy id", "Copied"] }}
                style={{ fontSize: 12, fontFamily: "monospace" }}
            >
                {simulationID}
            </Typography.Text>
        </div>
    );
};

export default SimulationIdBadge;
