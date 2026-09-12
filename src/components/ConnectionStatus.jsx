import { useEffect, useState } from "react";
import { Button, Tag, Tooltip } from "antd";
import { DisconnectOutlined, ReloadOutlined } from "@ant-design/icons";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";
import { notify } from "../utils/notify";

/**
 * Surfaces the socket's state, which nothing previously did.
 *
 * The backend holds the model and drives simulations, so a dropped connection
 * silently disables half the app. Before this, `connection-change` had no
 * subscribers at all: the graph stayed on screen, controls stayed enabled, and
 * actions quietly did nothing.
 */
const ConnectionStatus = () => {
    // Seeded from the live socket: the singleton connects at import, before this
    // ever mounts, so the first connection-change may already have fired.
    const [state, setState] = useState(() => ({
        connected: socketClientHelper.isConnected(),
        exhausted: false,
    }));

    useEffect(() => {
        const unsubConn = socketClientHelper.on("connection-change", ({ connected, exhausted }) => {
            setState((prev) => {
                if (connected && !prev.connected) notify.success("Reconnected to the GLIMPSE server.");
                return { connected, exhausted: connected ? false : (exhausted ?? prev.exhausted) };
            });
        });

        // Socket errors previously reached only the GridAPPS-D form, and only
        // while its modal happened to be open.
        const unsubErr = socketClientHelper.on("error", ({ type, message }) => {
            if (type === "connection") return; // the tag below already says this
            notify.error(`${type}: ${message}`);
        });

        return () => {
            unsubConn();
            unsubErr();
        };
    }, []);

    if (state.connected) return null;

    return (
        <Tooltip
            title={
                state.exhausted
                    ? "Gave up reconnecting to the GLIMPSE server. Live updates and simulation are unavailable until it is back."
                    : "Lost contact with the GLIMPSE server — retrying."
            }
        >
            <Tag
                icon={<DisconnectOutlined />}
                color={state.exhausted ? "error" : "warning"}
                style={{ marginInlineEnd: 0, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
                {state.exhausted ? "Disconnected" : "Reconnecting…"}
                {state.exhausted && (
                    <Button
                        size="small"
                        type="link"
                        icon={<ReloadOutlined />}
                        style={{ padding: 0, height: "auto" }}
                        onClick={() => {
                            setState((prev) => ({ ...prev, exhausted: false }));
                            socketClientHelper.reconnect();
                        }}
                    >
                        Retry
                    </Button>
                )}
            </Tag>
        </Tooltip>
    );
};

export default ConnectionStatus;
