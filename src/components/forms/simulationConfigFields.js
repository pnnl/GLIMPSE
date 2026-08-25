// Field definitions for SimulationConfigForm. Each entry describes one key of
// the default config objects in SocketClientHelper (powerSystemConfig /
// gridappsdConfiguration) and how to render it.
//
// input types: "text" | "number" (numeric string, precision kept) | "switch"
// (boolean) | "select" (options) | "datetime" (epoch seconds) | "json"
//
// Optional per-field keys: `rules` (extra antd validation rules, appended to the
// required rule) and `disabledWhen(context)` (locks the input based on the
// render context the form passes to renderFields).

// Add config field keys here (e.g. "duration", "use_houses", "encoding") to
// render that field greyed-out in the form. Values still submit with their
// current defaults — the input is just locked.
export const DISABLED_CONFIG_FIELDS = [];

export const isFieldDisabled = (key) => DISABLED_CONFIG_FIELDS.includes(key);

const YES_NO_OPTIONS = [
    { value: "y", label: "Yes (y)" },
    { value: "n", label: "No (n)" },
];

// Timing rules for simulation_config. GridAPPS-D only accepts runs whose
// duration, publish_period and interval line up, so the form enforces:
//
//   1. interval must divide publish_period evenly.
//   2. interval is pinned to 1 s while run_realtime is on (the input is locked
//      rather than validated — there is nothing else valid to type).
//   3. with run_realtime off, interval and publish_period must each be a
//      factor or a multiple of 60 s.
//   4. interval must divide duration evenly.

const DURATION_MIN = 1;
const PUBLISH_PERIOD_MIN = 3;
const INTERVAL_MIN = 1;

// The interval GridAPPS-D requires when the run follows the wall clock (rule 2).
export const REALTIME_INTERVAL = 1;

// These four constrain each other, so an edit to any one of them can invalidate
// another; SimulationConfigForm revalidates the group as a whole on change.
export const TIMING_FIELD_KEYS = ["duration", "publish_period", "interval", "run_realtime"];
export const VALIDATED_TIMING_FIELDS = ["duration", "publish_period", "interval"];

const simulationConfigPath = (key) => ["simulation_config", key];

// The number inputs run in stringMode, so values arrive as strings. null means
// "not a usable number", which keeps the cross-field checks quiet while a
// related field is still being typed into.
const toWholeSeconds = (value, min) => {
    const seconds = Number(value);
    return Number.isInteger(seconds) && seconds >= min ? seconds : null;
};

const divides = (factor, total) => total % factor === 0;

const isFactorOrMultipleOf60 = (seconds) => 60 % seconds === 0 || seconds % 60 === 0;

const reject = (message) => Promise.reject(new Error(message));

const SIXTY_HINT = "a factor or a multiple of 60 s (e.g. 5, 15, 30, 60, 120)";

const durationRule = {
    validator: (_, value) =>
        toWholeSeconds(value, DURATION_MIN) === null
            ? reject(`Duration must be a whole number of seconds (${DURATION_MIN} or more)`)
            : Promise.resolve(),
};

const publishPeriodRule = ({ getFieldValue }) => ({
    validator: (_, value) => {
        const publishPeriod = toWholeSeconds(value, PUBLISH_PERIOD_MIN);
        if (publishPeriod === null) {
            return reject(
                `Publish period must be a whole number of seconds (${PUBLISH_PERIOD_MIN} or more)`,
            );
        }
        // Rule 3 — only applies when the run is not following the wall clock.
        if (
            !getFieldValue(simulationConfigPath("run_realtime")) &&
            !isFactorOrMultipleOf60(publishPeriod)
        ) {
            return reject(`Publish period must be ${SIXTY_HINT}`);
        }
        return Promise.resolve();
    },
});

const intervalRule = ({ getFieldValue }) => ({
    validator: (_, value) => {
        const interval = toWholeSeconds(value, INTERVAL_MIN);
        if (interval === null) {
            return reject(`Interval must be a whole number of seconds (${INTERVAL_MIN} or more)`);
        }

        // Rule 2 — an interval of 1 satisfies rules 1, 3 and 4 by definition, so
        // this is the only check that matters in real time.
        if (getFieldValue(simulationConfigPath("run_realtime"))) {
            return interval === REALTIME_INTERVAL
                ? Promise.resolve()
                : reject(`Interval must be ${REALTIME_INTERVAL} s while Run in Real Time is on`);
        }

        // Rule 3
        if (!isFactorOrMultipleOf60(interval)) {
            return reject(`Interval must be ${SIXTY_HINT}`);
        }

        // Rule 1
        const publishPeriod = toWholeSeconds(
            getFieldValue(simulationConfigPath("publish_period")),
            PUBLISH_PERIOD_MIN,
        );
        if (publishPeriod !== null && !divides(interval, publishPeriod)) {
            return reject(`Interval must divide the publish period (${publishPeriod} s) evenly`);
        }

        // Rule 4
        const duration = toWholeSeconds(getFieldValue(simulationConfigPath("duration")), DURATION_MIN);
        if (duration !== null && !divides(interval, duration)) {
            return reject(`Interval must divide the duration (${duration} s) evenly`);
        }

        return Promise.resolve();
    },
});

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
        min: String(DURATION_MIN),
        step: "1",
        rules: [durationRule],
        tooltip: "How long the simulation runs. Must be an exact multiple of the interval.",
    },
    {
        key: "publish_period",
        label: "Publish Period (s)",
        input: "number",
        min: String(PUBLISH_PERIOD_MIN),
        step: "1",
        rules: [publishPeriodRule],
        tooltip: `How often results are published. Must be an exact multiple of the interval, and — outside real time — ${SIXTY_HINT}.`,
    },
    {
        key: "interval",
        label: "Interval (s)",
        input: "number",
        min: String(INTERVAL_MIN),
        step: "1",
        rules: [intervalRule],
        // Rule 2: nothing but 1 is valid in real time, so the input is locked.
        disabledWhen: ({ runRealtime }) => Boolean(runRealtime),
        tooltip: `Simulation time step. Must divide both the publish period and the duration evenly, and — outside real time — be ${SIXTY_HINT}. Locked to ${REALTIME_INTERVAL} s while Run in Real Time is on.`,
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
