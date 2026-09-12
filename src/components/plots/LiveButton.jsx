import { useEffect, useState } from "react";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";

const LiveButton = ({ following, onResume }) => {
    const isStreaming = (state) => state === "running" || state === "paused";
    const [streaming, setStreaming] = useState(() => isStreaming(socketClientHelper.simulationState));

    useEffect(() => {
        return socketClientHelper.on("sim-state-change", (state) => setStreaming(isStreaming(state)));
    }, []);

    if (following || !streaming) return null;

    return (
        <button
            type="button"
            className="chart-live-button"
            onClick={onResume}
            title="Jump back to the newest data"
        >
            ● Live
        </button>
    );
};

export default LiveButton;
