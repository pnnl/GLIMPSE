import { v4 as uuidv4 } from "uuid";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";

/**
 * Which live-control modal an element opens during a GridAPPS-D simulation, or
 * null. Switches (open/close) and regulators (tap positions) are edges;
 * capacitors (open/close) are nodes. A regulator is tagged by group (JSON/GLM)
 * or by class_type (CIM transformer edges).
 */
export const getControlType = ({ group, attributes }, elementType) => {
    if (elementType === "edge") {
        if (group === "regulator" || attributes?.class_type === "regulator") return "regulator";
        if (group === "switch") return "switch";
    } else if (elementType === "node" && group === "capacitor") {
        return "capacitor";
    }
    return null;
};

/** Sends a GridAPPS-D difference message to the running simulation. */
export const emitDifferences = (reverseDifferences, forwardDifferences) => {
    socketClientHelper.socket.emit("sim-input", {
        command: "update",
        input: {
            simulation_id: socketClientHelper.simulationID,
            message: {
                timestamp: Math.floor(Date.now() / 1000),
                difference_mrid: uuidv4(),
                reverse_differences: reverseDifferences,
                forward_differences: forwardDifferences,
            },
        },
    });
};
