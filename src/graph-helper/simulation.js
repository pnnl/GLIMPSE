// Decoding a GridAPPS-D simulation tick onto the graph.
//
// A `sim-output` message carries Analog measurements (PNV bus voltages, VA power
// flows) and Discrete ones (switch position, capacitor sections). The numbers
// land in the ephemeral `liveMeasurements` overlay — never in a model's own
// `attributes` — and drive the flow animation, the hover vitals and, when the
// user turns it on, violation-mode coloring.

import { hoverPayload } from "./element-factory";
import { edgeLoadingSummary, nodeVitals, refreshNodeHover } from "./measurements";
import { cleanPhase } from "../utils/live-measurements";
import { dotSpeedForLoading, edgeWidthForLoading } from "../utils/electrical";

// Real part of the complex power below this (in VA) is treated as zero so we
// don't pick a flow direction off of numerical noise.
const FLOW_THRESHOLD = 1e-6;

// Switch position keeps the utility reading — red is closed/energized, green is
// open — but the hues are pushed apart (green toward teal, red toward orange)
// because plain red/green is the pair red-green color vision deficiency
// collapses, and switch position is not something to leave ambiguous. The two
// sit ~ΔE 16 apart under simulated protanopia and deuteranopia, against ~10 for
// the pure red/green they replace, and both clear 3:1 on either canvas.
const SWITCH_CLOSED_COLOR = "#E04A1F";
const SWITCH_OPEN_COLOR = "#1F9E6E";
const NO_FLOW_COLOR = "rgba(145, 145, 145, 0.7)";

// A value of 0 means the switch is open; anything else means closed.
const switchStateFor = (value) => ({
    switchColor: value === 0 ? SWITCH_OPEN_COLOR : SWITCH_CLOSED_COLOR,
    status: value === 0 ? "OPEN" : "CLOSED",
});

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

/**
 * On a one-line diagram a single edge carries several VA measurements (one per
 * phase). The true power flow is the complex sum of all of them, so this stores
 * the per-phase readings and then aggregates each touched edge from its *full*
 * persisted phase map — a tick may carry only a subset of an edge's phases,
 * which would understate the total.
 *
 * magnitude/angle describe the polar form of each complex VA measurement
 * (angle is in degrees).
 *
 * @returns {Map<string, {real: number, imag: number, normalLimit: number|undefined}>}
 */
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
        let real = 0;
        let imag = 0;
        for (const phase of Object.values(edgeLive.power)) {
            if (Number.isFinite(phase.real)) real += phase.real;
            if (Number.isFinite(phase.imag)) imag += phase.imag;
        }

        // Complex sum -> apparent power, the quantity a rating is stated in.
        edgeLive.apparent = Math.hypot(real, imag);
        sums.set(edgeID, { real, imag, normalLimit: edgeLive.normalLimit });
    }

    return sums;
};

/**
 * Direction follows the sign of the real part of the summed power; when the real
 * part is ~0 fall back to the imaginary part. Same sign->direction mapping for
 * either: positive = from->to (forward), 0 = no flow.
 */
const flowDirectionOf = ({ real, imag }) => {
    if (Math.abs(real) >= FLOW_THRESHOLD) return real > 0 ? 1 : -1;
    if (Math.abs(imag) >= FLOW_THRESHOLD) return imag > 0 ? 1 : -1;
    return 0;
};

const animateFlow = (graph, live, theme, sums) => {
    for (const [edgeID, sum] of sums) {
        graph.updateEdgeAttributes(edgeID, (edgeAttrs) => {
            // Don't animate icon edges (switch/regulator/transformer, straight or
            // curved) — that would replace their custom symbol program.
            if (edgeAttrs.iconType) return edgeAttrs;

            const flowDirection = flowDirectionOf(sum);
            edgeAttrs.flowDirection = flowDirection;

            if (flowDirection === 0) {
                edgeAttrs.color = NO_FLOW_COLOR;
                edgeAttrs.type = "straight";
                return edgeAttrs;
            }

            edgeAttrs.type = "animated";
            // Restore the edge's theme color in case it was greyed out while it
            // had no flow on a previous tick.
            edgeAttrs.color = theme.edgeOptions[edgeAttrs.group]?.color ?? edgeAttrs.color;

            // Line thickness and dot speed track how hard the conductor is
            // working, using the same current ratio as the loading readout. The
            // mapping is calibrated in utils/electrical (and pinned by tests) so
            // it stays within a visible range.
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
    for (const measurement of discrete) {
        const id = measurement.equipment_mrid;
        const isEdge = graph.hasEdge(id) && !graph.hasNode(id);
        const isNode = graph.hasNode(id) && !graph.hasEdge(id);

        if (isEdge) {
            graph.updateEdgeAttributes(id, (edge) => {
                if (edge.group === "switch") {
                    const { switchColor, status } = switchStateFor(measurement.value);
                    edge.switchColor = switchColor;
                    edge.attributes.status = status;
                }

                return edge;
            });
        } else if (isNode) {
            graph.updateNodeAttributes(id, (node) => {
                if (node.group === "capacitor") {
                    node.attributes.sections = measurement.value;
                    Object.assign(node, hoverPayload(node.attributes, nodeVitals(graph, live, id)));
                }

                return node;
            });
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
    const { Analog, Discrete } = output;

    const nodesWithNewVoltage = recordVoltages(graph, live, Analog);
    for (const nodeId of nodesWithNewVoltage) refreshNodeHover(graph, live, nodeId);

    animateFlow(graph, live, theme, recordPowerFlows(graph, live, Analog));

    applyDiscrete(graph, live, Discrete);
};

/** Switch open/closed state pushed outside the regular measurement stream. */
export const applySwitchStates = (graph, simOutput) => {
    for (const sw of simOutput.switches) {
        const { equipment_mrid: switchID, value } = sw;

        if (!graph.hasEdge(switchID)) {
            console.warn(`Switch with ID ${switchID} not found in the graph.`);
            continue;
        }

        const { switchColor, status } = switchStateFor(value);
        graph.updateEdgeAttributes(switchID, (attrs) => ({
            ...attrs,
            switchColor,
            attributes: { ...attrs.attributes, status },
        }));
    }
};

/** Capacitor section counts pushed outside the regular measurement stream. */
export const applyCapacitorStates = (graph, live, simOutput) => {
    for (const cap of simOutput.capacitors) {
        const { equipment_mrid: capID, value } = cap;

        if (!graph.hasNode(capID)) {
            console.warn(`Capacitor with ID ${capID} not found in the graph.`);
            continue;
        }

        graph.updateNodeAttributes(capID, (attrs) => {
            const updated = { ...attrs, attributes: { ...attrs.attributes, sections: value } };
            // Keep the live vitals block — this update only changes the
            // capacitor's section count, not its voltage measurements.
            return { ...updated, ...hoverPayload(updated.attributes, nodeVitals(graph, live, capID)) };
        });
    }
};
