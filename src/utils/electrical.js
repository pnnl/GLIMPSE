// ── Voltage limits ──────────────────────────────────────────────────────────
// ANSI C84.1 service voltage limits, expressed per-unit. Range A is the normal
// operating band; Range B is the wider band that is tolerable but should be
// corrected. Outside Range B is treated as severe.
export const VOLTAGE_LIMITS = {
    rangeA: { min: 0.95, max: 1.05 },
    rangeB: { min: 0.9167, max: 1.0583 },
};

// ── Loading limits ──────────────────────────────────────────────────────────
// Fractions of an element's normal (continuous) rating.
export const LOADING_LIMITS = {
    elevated: 0.8, // worth noticing
    overloaded: 1.0, // above the normal rating
};

let _darkMode = false;

export const setSeverityDarkMode = (value) => {
    _darkMode = Boolean(value);
};

/** A severity whose `color` follows the active canvas theme. */
const severity = (level, label, light, dark) => ({
    level,
    label,
    get color() {
        return _darkMode ? dark : light;
    },
});

export const SEVERITY = {
    normal: severity("normal", "Normal", "#4F6470", "#7E94A6"),
    low: severity("low", "Undervoltage", "#3E8FD0", "#5BB4EE"),
    high: severity("high", "Overvoltage", "#C77700", "#E69F00"),
    severeLow: severity("severeLow", "Severe undervoltage", "#0A56B8", "#2E86FF"),
    severeHigh: severity("severeHigh", "Severe overvoltage", "#A31515", "#FF5C4D"),
    elevated: severity("elevated", "Elevated loading", "#C77700", "#E69F00"),
    overloaded: severity("overloaded", "Overloaded", "#A31515", "#FF5C4D"),
    unknown: severity("unknown", "No data", "#AFB6BA", "#5E6469"),
};

/** True for the classifications that should count as a violation. */
export const isViolation = (severity) =>
    severity != null && severity.level !== "normal" && severity.level !== "unknown";

const BASE_VOLTAGE_KEYS = [
    "nominal_voltage",
    "nominalVoltage",
    "base_voltage",
    "baseVoltage",
    "nominal_voltage_ln",
    "nomU",
];

/** Line-to-neutral bases for common North American distribution classes. */
export const STANDARD_LN_BASES = [
    120, // 120/240 split-phase, 208Y/120
    240,
    277, // 480Y/277
    2401.78, // 4160Y/2400
    4800, // 8320Y/4800
    7199.56, // 12470Y/7200
    7621.02, // 13200Y/7620
    7967.43, // 13800Y/7970
    12000, // 20780Y/12000
    14376, // 24900Y/14376
    19918.58, // 34500Y/19920
    39837.17, // 69000Y/39840
];

// How far from a standard base a reading may sit and still be attributed to it.
// 10% comfortably brackets the operating range of interest — ANSI Range B spans
// -8.3%/+5.8% — while still rejecting readings that belong to no known class.
const SNAP_TOLERANCE = 0.1;

/**
 * Infer the line-to-neutral base a measured magnitude belongs to: the closest
 * standard base within SNAP_TOLERANCE, or null if the reading isn't near any.
 *
 * Closest-wins rather than requiring an unambiguous match, because adjacent
 * distribution classes are only ~6% apart (12470Y/7200, 13200Y/7620 and
 * 13800Y/7970 all sit within 10% of one another) — demanding a unique candidate
 * would reject every reading in that band.
 *
 * The residual failure mode is a bus depressed far enough to sit nearer a lower
 * class (below roughly 0.9 p.u. of its true base), which would then read as
 * healthy. That is why an explicit nameplate always takes precedence — see
 * resolveBaseVoltage — and why the hover card marks an inferred base as such.
 *
 * @param {number} magnitude - measured volts
 * @returns {number|null}
 */
export const snapToStandardBase = (magnitude) => {
    if (!Number.isFinite(magnitude) || magnitude <= 0) return null;

    let best = null;
    let bestError = Infinity;

    for (const base of STANDARD_LN_BASES) {
        const error = Math.abs(magnitude / base - 1);
        if (error <= SNAP_TOLERANCE && error < bestError) {
            best = base;
            bestError = error;
        }
    }

    return best;
};

/**
 * Resolve the p.u. base for a node: nameplate attribute if there is a usable
 * one, else inferred from a sample measurement.
 *
 * @param {Object} attributes - the node's model attributes
 * @param {number} [sampleMagnitude] - an observed phase voltage, for inference
 * @returns {{ base: number, source: "attribute"|"inferred" } | null}
 */
export const resolveBaseVoltage = (attributes, sampleMagnitude) => {
    for (const key of BASE_VOLTAGE_KEYS) {
        const raw = attributes?.[key];
        if (raw === undefined || raw === null || raw === "") continue;
        // GLM values arrive as strings, sometimes with trailing unit text.
        const parsed = parseFloat(raw);
        if (Number.isFinite(parsed) && parsed > 0) {
            return { base: parsed, source: "attribute" };
        }
    }

    const inferred = snapToStandardBase(sampleMagnitude);
    return inferred ? { base: inferred, source: "inferred" } : null;
};

// ── Classification ──────────────────────────────────────────────────────────

/**
 * @param {number} pu - per-unit voltage
 * @returns {Object} one of SEVERITY
 */
export const classifyVoltage = (pu) => {
    if (!Number.isFinite(pu)) return SEVERITY.unknown;
    if (pu < VOLTAGE_LIMITS.rangeB.min) return SEVERITY.severeLow;
    if (pu > VOLTAGE_LIMITS.rangeB.max) return SEVERITY.severeHigh;
    if (pu < VOLTAGE_LIMITS.rangeA.min) return SEVERITY.low;
    if (pu > VOLTAGE_LIMITS.rangeA.max) return SEVERITY.high;
    return SEVERITY.normal;
};

/**
 * @param {number} ratio - apparent power / normal rating
 * @returns {Object} one of SEVERITY
 */
export const classifyLoading = (ratio) => {
    if (!Number.isFinite(ratio) || ratio < 0) return SEVERITY.unknown;
    if (ratio >= LOADING_LIMITS.overloaded) return SEVERITY.overloaded;
    if (ratio >= LOADING_LIMITS.elevated) return SEVERITY.elevated;
    return SEVERITY.normal;
};

// ── Summaries ───────────────────────────────────────────────────────────────

const PHASE_ORDER = ["A", "B", "C", "s1", "s2", "s12", "N"];
const orderPhases = (keys) =>
    [...keys].sort((a, b) => {
        const ia = PHASE_ORDER.indexOf(a);
        const ib = PHASE_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });

/**
 * Per-phase per-unit voltages for a node, plus the worst phase — the one that
 * determines whether the *node* counts as violating.
 *
 * @param {Object} attributes - node model attributes (for the nameplate base)
 * @param {Object} live - graphHelper.liveMeasurements.nodes entry
 * @returns {null | {
 *   base: number, baseSource: string,
 *   phases: Array<{ phase, magnitude, pu, severity }>,
 *   worst: { phase, magnitude, pu, severity }
 * }}
 */
export const summarizeNodeVoltage = (attributes, live) => {
    const voltage = live?.voltage;
    if (!voltage) return null;

    const phaseKeys = orderPhases(Object.keys(voltage));
    if (phaseKeys.length === 0) return null;

    // Use the largest reading to pick the base: on a node with a dead/open
    // phase, a near-zero magnitude would otherwise snap to the wrong class.
    const magnitudes = phaseKeys
        .map((p) => Number(voltage[p]?.magnitude))
        .filter((m) => Number.isFinite(m));
    if (magnitudes.length === 0) return null;

    const resolved = resolveBaseVoltage(attributes, Math.max(...magnitudes));
    if (!resolved) return null;

    const phases = phaseKeys.map((phase) => {
        const magnitude = Number(voltage[phase]?.magnitude);
        const pu = Number.isFinite(magnitude) ? magnitude / resolved.base : NaN;
        return { phase, magnitude, pu, severity: classifyVoltage(pu) };
    });

    // "Worst" = furthest from nominal in either direction.
    const rated = phases.filter((p) => Number.isFinite(p.pu));
    const worst = rated.length
        ? rated.reduce((a, b) => (Math.abs(b.pu - 1) > Math.abs(a.pu - 1) ? b : a))
        : null;

    if (!worst) return null;

    return { base: resolved.base, baseSource: resolved.source, phases, worst };
};

/**
 * Apparent power and loading for an edge.
 *
 * `normalLimit` is an **ampere** rating, so loading is current-based:
 *
 *     I_phase = S_phase / V_phase        (both per-phase quantities)
 *     loading = I_phase / normalLimit
 *
 * The rating applies per conductor, so the edge's severity is that of its
 * **worst phase** — the same rule used for node voltage.
 *
 * @param {Object} live - graphHelper.liveMeasurements.edges entry
 * @param {Object} [phaseVoltages] - { <phase>: volts } at one end of the edge,
 *   needed to convert power to current. Without it no loading is reported.
 * @returns {null | {
 *   apparent: number, normalLimit: number|null,
 *   phases: Array<{ phase, amps, ratio, severity }>,
 *   worst: { phase, amps, ratio, severity } | null,
 *   ratio: number|null, severity
 * }}
 */
export const summarizeEdgeLoading = (live, phaseVoltages) => {
    if (!live) return null;

    const apparent = Number(live.apparent);
    if (!Number.isFinite(apparent)) return null;

    const rawLimit = Number(live.normalLimit);
    const normalLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : null;

    const noLoading = {
        apparent,
        normalLimit,
        phases: [],
        worst: null,
        ratio: null,
        severity: SEVERITY.unknown,
    };

    if (normalLimit === null || !phaseVoltages) return noLoading;

    const phases = [];
    for (const phase of orderPhases(Object.keys(live.power ?? {}))) {
        const s = Number(live.power[phase]?.magnitude);
        const v = Number(phaseVoltages[phase]);
        // A collapsed phase voltage would divide into a nonsense current.
        if (!Number.isFinite(s) || !Number.isFinite(v) || v <= 0) continue;

        const amps = s / v;
        const ratio = amps / normalLimit;
        phases.push({ phase, amps, ratio, severity: classifyLoading(ratio) });
    }

    if (phases.length === 0) return noLoading;

    const worst = phases.reduce((a, b) => (b.ratio > a.ratio ? b : a));

    return {
        apparent,
        normalLimit,
        phases,
        worst,
        ratio: worst.ratio,
        severity: worst.severity,
    };
};

// ── Display formatting ──────────────────────────────────────────────────────

/** Volt-amperes to a compact "312 kVA" / "1.21 MVA" string. */
export const formatVA = (va) => {
    const v = Math.abs(Number(va));
    if (!Number.isFinite(v)) return "-";
    if (v >= 1e6) return `${(v / 1e6).toFixed(2)} MVA`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)} kVA`;
    return `${v.toFixed(0)} VA`;
};

/** Signed real/reactive power, e.g. "1.20 MW". */
export const formatWatts = (w, unit = "W") => {
    const v = Number(w);
    if (!Number.isFinite(v)) return "-";
    const a = Math.abs(v);
    if (a >= 1e6) return `${(v / 1e6).toFixed(2)} M${unit}`;
    if (a >= 1e3) return `${(v / 1e3).toFixed(1)} k${unit}`;
    return `${v.toFixed(0)} ${unit}`;
};

/** Current, e.g. "312 A". */
export const formatAmps = (amps) =>
    Number.isFinite(Number(amps)) ? `${Number(amps).toFixed(0)} A` : "-";

export const formatPu = (pu) => (Number.isFinite(pu) ? pu.toFixed(3) : "-");

export const formatPercent = (ratio) => (Number.isFinite(ratio) ? `${(ratio * 100).toFixed(0)}%` : "-");

export const EDGE_WIDTH_MIN = 1.5; // energized but essentially unloaded
export const EDGE_WIDTH_MAX = 6; // at or beyond EDGE_LOADING_FULL_SCALE
export const DOT_SPEED_MIN = 0.1; // cycles/sec — slow creep, still legible
export const DOT_SPEED_MAX = 1.0; // fast, without blurring into a solid line

// Loading at which the scales top out. Slightly above 1.0 so an overloaded line
// still reads as worse than a fully-loaded one before saturating.
export const EDGE_LOADING_FULL_SCALE = 1.25;

/** Normalized 0..1 position of a loading ratio on the visual scale. */
const loadingScale = (ratio) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return 0;
    return Math.sqrt(Math.min(ratio, EDGE_LOADING_FULL_SCALE) / EDGE_LOADING_FULL_SCALE);
};

/** Drawn edge width (screen px) for a loading ratio. */
export const edgeWidthForLoading = (ratio) =>
    EDGE_WIDTH_MIN + (EDGE_WIDTH_MAX - EDGE_WIDTH_MIN) * loadingScale(ratio);

/** Flow-dot speed (cycles/sec) for a loading ratio. */
export const dotSpeedForLoading = (ratio) =>
    DOT_SPEED_MIN + (DOT_SPEED_MAX - DOT_SPEED_MIN) * loadingScale(ratio);

// Rows for the violation-mode legend panel, in worsening order.
export const VIOLATION_LEGEND = [
    {
        severity: SEVERITY.normal,
        hint: `${VOLTAGE_LIMITS.rangeA.min}–${VOLTAGE_LIMITS.rangeA.max} p.u.`,
    },
    { severity: SEVERITY.low, hint: `< ${VOLTAGE_LIMITS.rangeA.min} p.u. (ANSI Range B)` },
    { severity: SEVERITY.high, hint: `> ${VOLTAGE_LIMITS.rangeA.max} p.u. (ANSI Range B)` },
    { severity: SEVERITY.severeLow, hint: `< ${VOLTAGE_LIMITS.rangeB.min} p.u.` },
    { severity: SEVERITY.severeHigh, hint: `> ${VOLTAGE_LIMITS.rangeB.max} p.u.` },
    { severity: SEVERITY.elevated, hint: `≥ ${LOADING_LIMITS.elevated * 100}% of ampere rating` },
    { severity: SEVERITY.overloaded, hint: `≥ ${LOADING_LIMITS.overloaded * 100}% of ampere rating` },
    { severity: SEVERITY.unknown, hint: "no measurement, rating, or base voltage" },
];
