import { useEffect, useState } from "react";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";

// Shown on a timeline chart once the user has scrolled away from the newest
// samples during a live run — one click jumps back to the live edge.
//
// Hidden when the view is already following, and while no run is streaming: a
// finished run has no live edge to return to, and the button would only be
// telling the user their scroll position is "wrong" when it isn't.
const LiveButton = ({ following, onResume }) => {
    const isStreaming = (state) => state === "running" || state === "paused";
    const [streaming, setStreaming] = useState(() =>
        isStreaming(socketClientHelper.simulationState),
    );

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
