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

const SIM_INPUT_ACK_MS = 10000;

/** Sends a GridAPPS-D difference message; resolves once the backend has published it. */
export const emitDifferences = (reverseDifferences, forwardDifferences) =>
    new Promise((resolve, reject) => {
        // socket.io would otherwise buffer it and replay a stale command on reconnect.
        if (!socketClientHelper.isConnected()) {
            reject(new Error("Not connected to the GLIMPSE server."));
            return;
        }

        const payload = {
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
        };

        socketClientHelper.socket.timeout(SIM_INPUT_ACK_MS).emit("sim-input", payload, (err, ack) => {
            if (err) reject(new Error("The server did not confirm the update."));
            else if (ack?.error) reject(new Error(ack.error));
            else resolve(ack);
        });
    });
