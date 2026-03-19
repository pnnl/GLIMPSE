import { io } from "socket.io-client";

class SocketClientHelper {
    simulationID = null;

    constructor() {
        this.socket = io("http://127.0.0.1:5051");
        // real-time updates from the server
        this.socket.on("update-data", (data) => {
            console.log(data);
        });
        this.socket.on("add-node", (data) => {
            console.log(data);
        });
        this.socket.on("add-edge", (data) => {
            console.log(data);
        });
        this.socket.on("delete-node", (nodeID) => {
            console.log(nodeID);
        });
        this.socket.on("delete-edge", (edgeID) => {
            console.log(edgeID);
        });

        // GridAPPS-D specific events
        this.socket.on("sim-output", (output) => {
            console.log(output);
        });
    }

    isConnected = () => {
        return this.socket.connected;
    };

    reconnect = () => {
        this.socket.connect();
    };

    startSimulation = (simulationConfig) => {
        // acknowledgment should be a simulation ID
        this.socket.emit("start-simulation", simulationConfig, (ack) => {
            print(ack);
            this.simulationID = ack.simulation_id;
            // TODO
            // show stop icon in the UI once the simulation starts
        });
    };

    stopSimulation = () => {
        // stopping simulation does not return an achnowledgment
        this.socket.emit("stop-simulation", this.simulationID);
        this.simulationID = null;
    };

    resumeSimulation = () => {
        this.socket.emit("resume-simulation", this.simulationID, (ack) => {
            // TODO
            // show pause icon in the UI once the simulation is resumed
        });
    };

    pauseSimulation = () => {
        this.socket.emit("pause-simulation", this.simulationID, (ack) => {
            // TODO
            // show play icon in the UI once the simulation is stopped
            console.log(ack);
        });
    };
}

const socketClientHelper = new SocketClientHelper();
export default socketClientHelper;
