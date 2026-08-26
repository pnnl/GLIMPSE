import { io } from "socket.io-client";
import graphHelper from "../graph-helper/GraphHelper";
import { API_BASE_URL, API_TOKEN, FEATURES } from "../config";

const NO_SIMULATION_MESSAGE = "Simulation is not available in this deployment.";

const inertSocket = () => ({
    id: null,
    connected: false,
    on: () => {},
    off: () => {},
    connect: () => {},
    disconnect: () => {},
    emit: (_event, ..._args) => {
        // The last argument is the ack callback when the caller expects a reply.
        const ack = _args[_args.length - 1];
        if (typeof ack === "function") ack({ error: NO_SIMULATION_MESSAGE });
    },
});

export const DEFAULT_POWER_SYSTEM_CONFIG = {
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

export const DEFAULT_GRIDAPPSD_CONFIGURATION = {
    power_system_configs: [],
    simulation_config: {
        start_time: 1774673298,
        duration: "120",
        interval: 1,
        publish_period: 3,
        run_realtime: true,
        simulation_name: "",
    },
    application_config: { applications: [] },
    service_configs: [],
    test_config: { events: [], appId: "" },
};

class SocketClientHelper {
    //  Active Configs (defaults until the simulation config form edits them)
    powerSystemConfig = structuredClone(DEFAULT_POWER_SYSTEM_CONFIG);

    gridappsdConfiguration = structuredClone(DEFAULT_GRIDAPPSD_CONFIGURATION);

    // Per-feeder power_system_config overrides keyed by model id, so each
    // loaded feeder keeps its own edits even if the model selection changes.
    powerSystemConfigOverrides = {};

    // True once the user has applied the simulation config form; the start
    // button uses this to skip the "proceed with defaults?" warning.
    simulationConfigCustomized = false;

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
                        attribute: "",
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
    simulationLogs = [];
    #MAX_SIM_LOGS = 1000;

    // Event Listeners
    #listeners = {
        "sim-output": [],
        "sim-log": [],
        "sim-log-clear": [],
        "sim-run-start": [],
        "sim-state-change": [],
        "connection-change": [],
        "model-load-progress": [],
        "load-graph": [],
        "update-data": [],
        "add-node": [],
        "add-edge": [],
        "delete-node": [],
        "delete-edge": [],
        "agents-update": [],
        error: [],
    };

    constructor(serverUrl = API_BASE_URL) {
        if (!FEATURES.simulation) {
            this.socket = inertSocket();
            return;
        }

        this.socket = io(serverUrl, {
            auth: API_TOKEN ? { token: API_TOKEN } : {},
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
            if (this.simulationState === "inactive") return;

            this.#emit("sim-output", output);
            graphHelper.handleSimulationOutput(output);
        });

        this.socket.on("sim-log", (log) => {
            this.simulationLogs.push(log);
            if (this.simulationLogs.length > this.#MAX_SIM_LOGS) {
                this.simulationLogs.shift();
            }

            if (log.processStatus === "COMPLETE") {
                graphHelper.reset();
                this.#emit("sim-state-change", "stopped");
            }
            this.#emit("sim-log", log);
        });

        this.socket.on("sim-state-change", (state) => {
            this.simulationState = state;
            this.#emit("sim-state-change", state);
        });

        this.socket.on("model-load-progress", (progress) => {
            this.#emit("model-load-progress", progress);
        });

        this.socket.on("switch-state-update", (data) => {
            graphHelper.updateSwitches(data);
        });

        this.socket.on("capacitor-state-update", (data) => {
            graphHelper.updateCapacitors(data);
        });

        this.socket.on("load-graph", (payload) => {
            try {
                graphHelper.loadGraphFromData(payload?.data ?? payload, payload?.themeData ?? null);
            } catch (err) {
                console.error("[Socket] Failed to load graph:", err);
                this.#emit("error", { type: "load-graph", message: err.message });
                return;
            }
            this.#emit("load-graph", payload);
        });

        this.socket.on("update-data", (data) => {
            graphHelper.applyUpdate(data);
            this.#emit("update-data", data);
        });
        this.socket.on("add-node", (data) => {
            graphHelper.addNode(data);
            this.#emit("add-node", data);
        });
        this.socket.on("add-edge", (data) => {
            graphHelper.addEdge(data);
            this.#emit("add-edge", data);
        });
        this.socket.on("delete-node", (id) => {
            graphHelper.deleteNode(id);
            this.#emit("delete-node", id);
        });
        this.socket.on("delete-edge", (id) => {
            graphHelper.deleteEdge(id);
            this.#emit("delete-edge", id);
        });

        this.socket.on("agents-update", (data) => {
            graphHelper.applyAgentUpdate(data);
            this.#emit("agents-update", data);
        });
    }

    // Event Emitter
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

    // Simulation Configuration

    buildPowerSystemConfig = (model) => {
        const base = this.powerSystemConfigOverrides[model.modelId] ?? this.powerSystemConfig;
        const config = structuredClone(base);
        config.SubGeographicalRegion_name = model.subRegionId;
        config.GeographicalRegion_name = model.regionId;
        config.Line_name = model.modelId;
        return config;
    };

    buildGridappsdConfig = (models = []) => ({
        ...structuredClone(this.gridappsdConfiguration),
        power_system_configs: models.map(this.buildPowerSystemConfig),
    });

    /** Same shape as buildGridappsdConfig, but from the pristine defaults. */
    buildDefaultGridappsdConfig = (models = []) => ({
        ...structuredClone(DEFAULT_GRIDAPPSD_CONFIGURATION),
        power_system_configs: models.map((model) => {
            const config = structuredClone(DEFAULT_POWER_SYSTEM_CONFIG);
            config.SubGeographicalRegion_name = model.subRegionId;
            config.GeographicalRegion_name = model.regionId;
            config.Line_name = model.modelId;
            return config;
        }),
    });

    applySimulationConfig = ({ simulationConfig, advancedConfig, powerSystemConfigsByModelId } = {}) => {
        if (simulationConfig) {
            this.gridappsdConfiguration.simulation_config = {
                ...this.gridappsdConfiguration.simulation_config,
                ...simulationConfig,
            };
        }
        if (advancedConfig) {
            Object.assign(this.gridappsdConfiguration, structuredClone(advancedConfig));
        }
        if (powerSystemConfigsByModelId) {
            Object.assign(this.powerSystemConfigOverrides, structuredClone(powerSystemConfigsByModelId));
        }
        this.simulationConfigCustomized = true;
    };

    /** Drop every edit and return to the pristine defaults. */
    resetSimulationConfig = () => {
        this.powerSystemConfig = structuredClone(DEFAULT_POWER_SYSTEM_CONFIG);
        this.gridappsdConfiguration = structuredClone(DEFAULT_GRIDAPPSD_CONFIGURATION);
        this.powerSystemConfigOverrides = {};
        this.simulationConfigCustomized = false;
    };

    // Simulation Control

    startSimulation = (models) => {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                reject(new Error("Socket not connected to server."));
                return;
            }

            this.clearSimulationLogs();
            this.#emit("sim-run-start");

            const gridappsdConfig = this.buildGridappsdConfig(models);

            console.log(gridappsdConfig);

            this.socket.emit("start-simulation", gridappsdConfig, (ack) => {
                console.log(ack);
                if (!ack || ack.error) {
                    this.simulationState = "error";
                    this.#emit("sim-state-change", "error");
                    const errorMsg =
                        ack?.error?.message || ack?.error || "Unknown error starting simulation";
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
        if (state === "inactive") this.simulationID = null;

        this.simulationState = state;
        this.#emit("sim-state-change", state);
    };

    detachSimulation = () => {
        const wasLive = this.simulationState === "running" || this.simulationState === "paused";

        if (wasLive && this.simulationID) {
            this.socket.emit("stop-simulation", this.simulationID);
        }

        this.clearSimulationLogs();
        this.setSimulationState("inactive");
    };

    getSimulationLogs = () => [...this.simulationLogs];

    clearSimulationLogs = () => {
        this.simulationLogs = [];
        this.#emit("sim-log-clear");
    };

    getStatus = () => ({
        socketConnected: this.isConnected(),
        simulationID: this.simulationID,
        simulationState: this.simulationState,
    });
}

const socketClientHelper = new SocketClientHelper();
export default socketClientHelper;
