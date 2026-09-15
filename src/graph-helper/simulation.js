import { hoverPayload } from "./element-factory";
import { edgeLoadingSummary, nodeVitals, refreshNodeHover, sumPower } from "./measurements";
import { cleanPhase } from "../utils/live-measurements";
import { dotSpeedForLoading, edgeWidthForLoading } from "../utils/electrical";

const FLOW_THRESHOLD = 1e-6;

const SWITCH_CLOSED_COLOR = "#E04A1F";
const SWITCH_OPEN_COLOR = "#1F9E6E";
const NO_FLOW_COLOR = "rgba(145, 145, 145, 0.7)";

// A value of 0 means the switch is open; anything else means closed.
const setSwitchState = (graph, switchID, value) => {
    const open = value === 0;
    graph.updateEdgeAttributes(switchID, (attrs) => ({
        ...attrs,
        switchColor: open ? SWITCH_OPEN_COLOR : SWITCH_CLOSED_COLOR,
        attributes: { ...attrs.attributes, status: open ? "OPEN" : "CLOSED" },
    }));
};

const setCapacitorSections = (graph, live, capID, sections) => {
    graph.updateNodeAttributes(capID, (attrs) => {
        const attributes = { ...attrs.attributes, sections };
        return { ...attrs, attributes, ...hoverPayload(attributes, nodeVitals(graph, live, capID)) };
    });
};

// ── Analog: bus voltages (PNV) ──────────────────────────────────────────────

/**
 * PNV magnitude/angle describe the phase voltage at the measurement's terminal;
 * attribute it to the bus (ConnectivityNode) it sits on, or to the equipment
 * itself when that equipment is a graph node (e.g. a load).
 *
 * @returns {Set<string>} the nodes whose voltage changed this tick
 */
const recordVoltages = (graph, live, analog) => {
    const touched = new Set();

    for (const measurement of analog) {
        if (measurement.measurement_type !== "PNV") continue;

        let nodeId = null;
        if (measurement.connectivity_node_mrid && graph.hasNode(measurement.connectivity_node_mrid)) {
            nodeId = measurement.connectivity_node_mrid;
        } else if (graph.hasNode(measurement.equipment_mrid)) {
            nodeId = measurement.equipment_mrid;
        }
        if (!nodeId) continue;

        const nodeLive = live.nodes.get(nodeId) || { voltage: {} };
        nodeLive.voltage[cleanPhase(measurement.phases)] = {
            magnitude: measurement.magnitude,
            angle: measurement.angle,
        };
        live.nodes.set(nodeId, nodeLive);
        touched.add(nodeId);
    }

    return touched;
};

// ── Analog: power flow on edges (VA) ────────────────────────────────────────

const recordPowerFlows = (graph, live, analog) => {
    const touched = new Set();

    for (const measurement of analog) {
        // Only VA (power) measurements determine flow; skip PNV/Pos/etc.
        if (measurement.measurement_type !== "VA") continue;
        if (!graph.hasEdge(measurement.equipment_mrid) || graph.hasNode(measurement.equipment_mrid)) {
            continue;
        }

        const angleRad = (measurement.angle * Math.PI) / 180;

        const edgeLive = live.edges.get(measurement.equipment_mrid) || { power: {} };
        edgeLive.power[cleanPhase(measurement.phases)] = {
            real: measurement.magnitude * Math.cos(angleRad),
            imag: measurement.magnitude * Math.sin(angleRad),
            magnitude: measurement.magnitude,
            angle: measurement.angle,
        };
        // The element's continuous rating, kept on the overlay so percent loading
        // can be computed anywhere (hover card, tables, violation mode).
        if (edgeLive.normalLimit == null && measurement.normal_limit) {
            edgeLive.normalLimit = measurement.normal_limit.Normal;
        }
        live.edges.set(measurement.equipment_mrid, edgeLive);

        touched.add(measurement.equipment_mrid);
    }

    const sums = new Map();
    for (const edgeID of touched) {
        const edgeLive = live.edges.get(edgeID);
        const { real, imag } = sumPower(edgeLive.power);

        // Complex sum -> apparent power, the quantity a rating is stated in.
        edgeLive.apparent = Math.hypot(real, imag);
        sums.set(edgeID, { real, imag, normalLimit: edgeLive.normalLimit });
    }

    return sums;
};

const flowDirectionOf = ({ real, imag }) => {
    if (Math.abs(real) >= FLOW_THRESHOLD) return real > 0 ? 1 : -1;
    if (Math.abs(imag) >= FLOW_THRESHOLD) return imag > 0 ? 1 : -1;
    return 0;
};

const animateFlow = (graph, live, theme, sums) => {
    for (const [edgeID, sum] of sums) {
        graph.updateEdgeAttributes(edgeID, (edgeAttrs) => {
            if (edgeAttrs.iconType) return edgeAttrs;

            const flowDirection = flowDirectionOf(sum);
            edgeAttrs.flowDirection = flowDirection;

            if (flowDirection === 0) {
                // Theme-aware so dead lines recede on the dark canvas too.
                edgeAttrs.color = theme.groups?.inactive?.color ?? NO_FLOW_COLOR;
                edgeAttrs.type = "straight";
                return edgeAttrs;
            }

            edgeAttrs.type = "animated";
            edgeAttrs.color = theme.edgeOptions[edgeAttrs.group]?.color ?? edgeAttrs.color;
            const loading = edgeLoadingSummary(graph, live, edgeID)?.ratio;
            if (loading != null) {
                edgeAttrs.size = edgeWidthForLoading(loading);
                edgeAttrs.dotSpeed = dotSpeedForLoading(loading);
            }

            return edgeAttrs;
        });
    }
};

// ── Discrete: switch position and capacitor sections ────────────────────────

const applyDiscrete = (graph, live, discrete) => {
    for (const { equipment_mrid: id, value } of discrete) {
        const isEdge = graph.hasEdge(id) && !graph.hasNode(id);
        const isNode = graph.hasNode(id) && !graph.hasEdge(id);

        if (isEdge && graph.getEdgeAttribute(id, "group") === "switch") {
            setSwitchState(graph, id, value);
        } else if (isNode && graph.getNodeAttribute(id, "group") === "capacitor") {
            setCapacitorSections(graph, live, id, value);
        }
    }
};

// ── Entry points ────────────────────────────────────────────────────────────

/**
 * Applies one simulation tick.
 *
 * Voltages are recorded BEFORE power flows: edge loading is a current ratio
 * (I = S / V), so the voltages have to be in the overlay before any edge is
 * evaluated — otherwise the first tick of every run has no loading.
 *
 * @param {Object} ctx - { graph, live, theme }
 * @param {Object} output - the `sim-output` payload: { Analog, Discrete }
 */
export const applySimulationOutput = ({ graph, live, theme }, output) => {
    // A sim-output frame comes off the broker, so no key is guaranteed present.
    const Analog = Array.isArray(output?.Analog) ? output.Analog : [];
    const Discrete = Array.isArray(output?.Discrete) ? output.Discrete : [];

    const nodesWithNewVoltage = recordVoltages(graph, live, Analog);
    for (const nodeId of nodesWithNewVoltage) refreshNodeHover(graph, live, nodeId);

    animateFlow(graph, live, theme, recordPowerFlows(graph, live, Analog));

    applyDiscrete(graph, live, Discrete);
};

/** Switch open/closed state pushed outside the regular measurement stream. */
export const applySwitchStates = (graph, simOutput) => {
    for (const { equipment_mrid: switchID, value } of simOutput?.switches ?? []) {
        if (!graph.hasEdge(switchID)) {
            console.warn(`Switch with ID ${switchID} not found in the graph.`);
            continue;
        }
        setSwitchState(graph, switchID, value);
    }
};

/** Capacitor section counts pushed outside the regular measurement stream. */
export const applyCapacitorStates = (graph, live, simOutput) => {
    for (const { equipment_mrid: capID, value } of simOutput?.capacitors ?? []) {
        if (!graph.hasNode(capID)) {
            console.warn(`Capacitor with ID ${capID} not found in the graph.`);
            continue;
        }
        setCapacitorSections(graph, live, capID, value);
    }
};
