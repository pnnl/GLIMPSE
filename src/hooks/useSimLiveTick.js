import { useEffect, useState } from "react";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";

export const useSimLiveTick = (throttleMs = 800) => {
    const isLive = (s) => s === "running" || s === "paused";
    const [simActive, setSimActive] = useState(() => isLive(socketClientHelper.simulationState));
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let last = 0;
        const unsubOutput = socketClientHelper.on("sim-output", () => {
            const now = Date.now();
            if (now - last >= throttleMs) {
                last = now;
                setTick((t) => t + 1);
            }
        });
        const unsubState = socketClientHelper.on("sim-state-change", (state) => {
            setSimActive(isLive(state));
            setTick((t) => t + 1);
        });
        return () => {
            unsubOutput();
            unsubState();
        };
    }, [throttleMs]);

    return { simActive, tick };
};

export default useSimLiveTick;
