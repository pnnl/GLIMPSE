import { useEffect, useState } from "react";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";

/**
 * React hook exposing the current simulation liveness plus a throttled `tick`
 * that increments on each sim-output frame. Components read the actual values
 * from graphHelper.liveMeasurements; the tick just forces them to re-render as
 * new frames arrive — throttled so a fast sim stream doesn't re-render on every
 * single socket message.
 *
 * `simActive` is true while the simulation is running or paused, gating the
 * live UI (voltage/power columns, Edit Object live rows) to the run lifecycle.
 */
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
