import { io } from "socket.io-client";
import graphHelper from "../graph-helper/GraphHelper";

class SocketClientHelper {
    //  Default Configs
    powerSystemConfig = {
        SubGeographicalRegion_name: "",
        GeographicalRegion_name: "",
        Line_name: "",
        simulator_config: {
            simulator: "GridLAB-D",
            simulation_output: {},
            power_flow_solver_method: "NR",
            model_creation_config: {
                load_scaling_factor: "1.0",
                schedule_name: "ieeezipload",
                triplex: "y",
                encoding: "u",
                system_frequency: "60",
                voltage_multiplier: "1.0",
                power_unit_conversion: "1.0",
                unique_names: "y",
                z_fraction: "0.0",
                i_fraction: "1.0",
                p_fraction: "0.0",
                randomize_zipload_fractions: false,
                use_houses: false,
            },
        },
    };

    gridappsdConfiguration = {
        power_system_configs: [],
        simulation_config: {
            start_time: 1774673298,
            duration: "120",
            timestep_frequency: "1000",
            timestep_increment: "1000",
            run_realtime: true,
            simulation_name: "",
        },
        application_config: { applications: [] },
        service_configs: [],
        test_config: { events: [], appId: "" },
    };

    inputMessage = {
        command: "update",
        input: {
            simulation_id: "",
            message: {
                timestamp: "", // time of message being sent in seconds
                difference_mrid: "", // can be a random UUID
                reverse_differences: [
                    {
                        object: "",
                        attribute: "", // switch.open
                        value: "",
                    },
                ],
                forward_differences: [
                    {
                        object: "",
                        attribute: "",
                        value: "",
                    },
                ],
            },
        },
    };

    // State
    simulationID = null;
    simulationState = "inactive"; // inactive | idle | running | paused | stopped | error

    // Event Listeners
    #listeners = {
        "sim-output": [],
        "sim-log": [],
        "sim-state-change": [],
        "connection-change": [],
        "update-data": [],
        "add-node": [],
        "add-edge": [],
        "delete-node": [],
        "delete-edge": [],
        error: [],
    };

    constructor(serverUrl = "http://127.0.0.1:5051") {
        this.socket = io(serverUrl, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 15000,
        });

        this.#setupSocketListeners();
    }

    // Internal Setup

    #setupSocketListeners() {
        // Connection events
        this.socket.on("connect", () => {
            console.log("[Socket] Connected:", this.socket.id);
            this.#emit("connection-change", { connected: true });
        });

        this.socket.on("disconnect", (reason) => {
            console.warn("[Socket] Disconnected:", reason);
            this.#emit("connection-change", { connected: false, reason });
        });

        this.socket.on("connect_error", (err) => {
            console.error("[Socket] Connection error:", err.message);
            this.#emit("error", { type: "connection", message: err.message });
        });

        // Simulation events
        this.socket.on("sim-output", (output) => {
            // console.log(output);
            this.#emit("sim-output", output);
        });

        this.socket.on("sim-log", (log) => {
            // console.log(log);
            if (log.processStatus === "COMPLETE") {
                this.#emit("sim-state-change", "stopped");
            }
            this.#emit("sim-log", log);
        });

        this.socket.on("sim-state-change", (state) => {
            this.simulationState = state;
            this.#emit("sim-state-change", state);
        });

        this.socket.on("switch-state-update", (data) => {
            graphHelper.updateSwitches(data);
        });

        this.socket.on("capacitor-state-update", (data) => {
            graphHelper.updateCapacitors(data);
        });

        // Graph mutation events
        this.socket.on("update-data", (data) => this.#emit("update-data", data));
        this.socket.on("add-node", (data) => this.#emit("add-node", data));
        this.socket.on("add-edge", (data) => this.#emit("add-edge", data));
        this.socket.on("delete-node", (id) => this.#emit("delete-node", id));
        this.socket.on("delete-edge", (id) => this.#emit("delete-edge", id));
    }

    // Event Emitter

    /**
     * Register a listener for a specific event.
     * Returns an unsubscribe function.
     */
    on(event, callback) {
        if (!(event in this.#listeners)) {
            console.warn(`[Socket] Unknown event: "${event}"`);
            this.#listeners[event] = [];
        }
        this.#listeners[event].push(callback);

        // Return an unsubscribe function for easy cleanup
        return () => {
            this.#listeners[event] = this.#listeners[event].filter((cb) => cb !== callback);
        };
    }

    /**
     * Remove a specific listener, or all listeners for an event.
     */
    off(event, callback = null) {
        if (!(event in this.#listeners)) return;
        if (callback) {
            this.#listeners[event] = this.#listeners[event].filter((cb) => cb !== callback);
        } else {
            this.#listeners[event] = [];
        }
    }

    #emit(event, data) {
        if (this.#listeners[event]) {
            for (const cb of this.#listeners[event]) {
                try {
                    cb(data);
                } catch (err) {
                    console.error(`[Socket] Error in "${event}" listener:`, err);
                }
            }
        }
    }

    // Connection

    isConnected = () => this.socket.connected;

    reconnect = () => {
        if (!this.socket.connected) {
            this.socket.connect();
        }
    };

    disconnect = () => {
        this.socket.disconnect();
        this.simulationID = null;
        this.simulationState = "inactive";
    };

    // Simulation Control

    startSimulation = (models) => {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                reject(new Error("Socket not connected to server."));
                return;
            }

            const gridappsdConfig = {
                ...this.gridappsdConfiguration,
                power_system_configs: models.map((model) => ({
                    ...this.powerSystemConfig,
                    SubGeographicalRegion_name: model.subRegionId,
                    GeographicalRegion_name: model.regionId,
                    Line_name: model.modelId,
                })),
            };

            console.log(gridappsdConfig);

            this.socket.emit("start-simulation", gridappsdConfig, (ack) => {
                console.log(ack);
                if (!ack || ack.error) {
                    this.simulationState = "error";
                    this.#emit("sim-state-change", "error");
                    const errorMsg = ack?.error?.message || "Unknown error starting simulation";
                    this.#emit("error", { type: "simulation", message: errorMsg });
                    reject(new Error(errorMsg));
                    return;
                }

                this.simulationID = ack.simulation_id;
                this.simulationState = ack.state;
                this.#emit("sim-state-change", "running");
                resolve(ack);
            });
        });
    };

    pauseSimulation = () => {
        return new Promise((resolve, reject) => {
            if (!this.simulationID) {
                reject(new Error("No active simulation to pause."));
                return;
            }

            this.socket.emit("pause-simulation", this.simulationID, (ack) => {
                if (ack?.error) {
                    this.#emit("error", { type: "simulation", message: ack.error });
                    reject(new Error(ack.error));
                    return;
                }
                this.simulationState = "paused";
                this.#emit("sim-state-change", "paused");
                resolve(ack);
            });
        });
    };

    resumeSimulation = () => {
        return new Promise((resolve, reject) => {
            if (!this.simulationID) {
                reject(new Error("No active simulation to resume."));
                return;
            }

            this.socket.emit("resume-simulation", this.simulationID, (ack) => {
                if (ack?.error) {
                    this.#emit("error", { type: "simulation", message: ack.error });
                    reject(new Error(ack.error));
                    return;
                }
                this.simulationState = "running";
                this.#emit("sim-state-change", "running");
                resolve(ack);
            });
        });
    };

    stopSimulation = () => {
        return new Promise((resolve, reject) => {
            if (!this.simulationID) {
                reject(new Error("No active simulation to stop."));
                return;
            }

            this.socket.emit("stop-simulation", this.simulationID, (ack) => {
                this.simulationID = null;
                this.simulationState = ack.state;
                this.#emit("sim-state-change", ack.state);
                resolve(ack);
            });
        });
    };

    setSimulationState = (state) => {
        this.simulationState = state;
        this.#emit("sim-state-change", state);
    };

    getStatus = () => ({
        socketConnected: this.isConnected(),
        simulationID: this.simulationID,
        simulationState: this.simulationState,
    });
}

const socketClientHelper = new SocketClientHelper();
export default socketClientHelper;
