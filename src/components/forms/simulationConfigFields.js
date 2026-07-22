// Field definitions for SimulationConfigForm. Each entry describes one key of
// the default config objects in SocketClientHelper (powerSystemConfig /
// gridappsdConfiguration) and how to render it.
//
// input types: "text" | "number" (numeric string, precision kept) | "switch"
// (boolean) | "select" (options) | "datetime" (epoch seconds) | "json"

// Add config field keys here (e.g. "duration", "use_houses", "encoding") to
// render that field greyed-out in the form. Values still submit with their
// current defaults — the input is just locked.
export const DISABLED_CONFIG_FIELDS = [];

export const isFieldDisabled = (key) => DISABLED_CONFIG_FIELDS.includes(key);

const YES_NO_OPTIONS = [
    { value: "y", label: "Yes (y)" },
    { value: "n", label: "No (n)" },
];

// gridappsdConfiguration.simulation_config — one per simulation, shared by
// every feeder in the run.
export const SIMULATION_CONFIG_FIELDS = [
    {
        key: "simulation_name",
        label: "Simulation Name",
        input: "text",
    },
    {
        key: "start_time",
        label: "Start Time",
        input: "datetime",
        tooltip: "Simulation clock start, sent to GridAPPS-D as epoch seconds.",
    },
    {
        key: "duration",
        label: "Duration (s)",
        input: "number",
        min: "1",
        step: "1",
    },
    {
        key: "timestep_frequency",
        label: "Timestep Frequency (ms)",
        input: "number",
        min: "1",
        step: "1",
    },
    {
        key: "timestep_increment",
        label: "Timestep Increment (ms)",
        input: "number",
        min: "1",
        step: "1",
    },
    {
        key: "run_realtime",
        label: "Run in Real Time",
        input: "switch",
        tooltip:
            "On: the simulation advances with the wall clock. Off: it runs in simulation time, faster than real time.",
    },
];

// powerSystemConfig.simulator_config — one per feeder.
export const SIMULATOR_CONFIG_FIELDS = [
    {
        key: "simulator",
        label: "Simulator",
        input: "text",
    },
    {
        key: "power_flow_solver_method",
        label: "Power Flow Solver Method",
        input: "select",
        options: [
            { value: "NR", label: "Newton-Raphson (NR)" },
            { value: "FBS", label: "Forward-Back Sweep (FBS)" },
        ],
    },
];

// powerSystemConfig.simulator_config.model_creation_config — one per feeder.
export const MODEL_CREATION_CONFIG_FIELDS = [
    { key: "load_scaling_factor", label: "Load Scaling Factor", input: "number", step: "0.1" },
    { key: "schedule_name", label: "Schedule Name", input: "text" },
    { key: "triplex", label: "Triplex", input: "select", options: YES_NO_OPTIONS },
    { key: "encoding", label: "Encoding", input: "text" },
    { key: "system_frequency", label: "System Frequency (Hz)", input: "number", step: "1" },
    { key: "voltage_multiplier", label: "Voltage Multiplier", input: "number", step: "0.1" },
    { key: "power_unit_conversion", label: "Power Unit Conversion", input: "number", step: "0.1" },
    { key: "unique_names", label: "Unique Names", input: "select", options: YES_NO_OPTIONS },
    {
        key: "z_fraction",
        label: "Z Fraction",
        input: "number",
        min: "0",
        step: "0.1",
        tooltip: "Constant-impedance share of the ZIP load model.",
    },
    {
        key: "i_fraction",
        label: "I Fraction",
        input: "number",
        min: "0",
        step: "0.1",
        tooltip: "Constant-current share of the ZIP load model.",
    },
    {
        key: "p_fraction",
        label: "P Fraction",
        input: "number",
        min: "0",
        step: "0.1",
        tooltip: "Constant-power share of the ZIP load model.",
    },
    {
        key: "randomize_zipload_fractions",
        label: "Randomize ZIP Load Fractions",
        input: "switch",
    },
    { key: "use_houses", label: "Use Houses", input: "switch" },
];

// Remaining top-level gridappsdConfiguration sections, edited as raw JSON.
export const ADVANCED_CONFIG_FIELDS = [
    { key: "application_config", label: "Application Config", input: "json" },
    { key: "service_configs", label: "Service Configs", input: "json" },
    { key: "test_config", label: "Test Config", input: "json" },
];
