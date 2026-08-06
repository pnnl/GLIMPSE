// Reads over the live-simulation overlay (`graphHelper.liveMeasurements`).
//
// Everything here is a pure function of (graph, overlay, id): voltage and
// loading summaries, the severity that drives violation-mode coloring, and the
// colored "vitals" lines that lead a hover card. The heavy electrical math
// itself lives in utils/electrical.js — this module is the glue that pulls the
// model attributes and the measurements together.

import { hoverPayload } from "./element-factory";
import {
    SEVERITY,
    formatAmps,
    formatPercent,
    formatPu,
    formatVA,
    formatWatts,
    isViolation,
    resolveBaseVoltage,
    summarizeEdgeLoading,
    summarizeNodeVoltage,
} from "../utils/electrical";

/**
 * Voltage summary for a node, or null when it has no measurement (or no
 * resolvable base voltage). See utils/electrical.summarizeNodeVoltage.
 */
export const nodeVoltageSummary = (graph, live, nodeId) => {
    if (!graph.hasNode(nodeId)) return null;
    const measured = live.nodes.get(nodeId);
    if (!measured) return null;
    return summarizeNodeVoltage(graph.getNodeAttribute(nodeId, "attributes"), measured);
};

/**
 * Per-phase voltages to convert an edge's power into current. Prefers a
 * measured PNV at either endpoint; falls back to an endpoint's resolved base
 * voltage, which is close enough for a loading percentage (within a few
 * percent) and much better than reporting nothing.
 *
 * @returns {Object|null} { <phase>: volts }
 */
const edgeReferenceVoltages = (graph, live, edgeId) => {
    const endpoints = graph.extremities(edgeId);

    for (const nodeId of endpoints) {
        const measured = live.nodes.get(nodeId)?.voltage;
        if (measured && Object.keys(measured).length > 0) {
            return Object.fromEntries(
                Object.entries(measured).map(([phase, v]) => [phase, Number(v.magnitude)]),
            );
        }
    }

    // No PNV on either end — fall back to a nameplate/inferred base, applied
    // to every phase the edge carries power on.
    for (const nodeId of endpoints) {
        const attributes = graph.getNodeAttribute(nodeId, "attributes");
        const resolved = resolveBaseVoltage(attributes);
        if (!resolved) continue;

        const phases = Object.keys(live.edges.get(edgeId)?.power ?? {});
        if (phases.length === 0) return null;
        return Object.fromEntries(phases.map((phase) => [phase, resolved.base]));
    }

    return null;
};

/** Loading summary for an edge, or null when it has no power measurement. */
export const edgeLoadingSummary = (graph, live, edgeId) => {
    if (!graph.hasEdge(edgeId)) return null;
    const measured = live.edges.get(edgeId);
    if (!measured) return null;
    return summarizeEdgeLoading(measured, edgeReferenceVoltages(graph, live, edgeId));
};

/** Severity object (see electrical.SEVERITY) driving violation-mode color. */
export const nodeSeverity = (graph, live, nodeId) =>
    nodeVoltageSummary(graph, live, nodeId)?.worst.severity ?? SEVERITY.unknown;

export const edgeSeverity = (graph, live, edgeId) =>
    edgeLoadingSummary(graph, live, edgeId)?.severity ?? SEVERITY.unknown;

/**
 * Counts for the violation legend, so the user can see at a glance whether
 * anything is wrong without hunting across the canvas.
 * @returns {{ nodes: Object<string, number>, edges: Object<string, number>, total: number }}
 */
export const violationCounts = (graph, live) => {
    const nodes = {};
    const edges = {};
    let total = 0;

    for (const nodeId of live.nodes.keys()) {
        const severity = nodeSeverity(graph, live, nodeId);
        nodes[severity.level] = (nodes[severity.level] ?? 0) + 1;
        if (isViolation(severity)) total++;
    }

    for (const edgeId of live.edges.keys()) {
        const severity = edgeSeverity(graph, live, edgeId);
        edges[severity.level] = (edges[severity.level] ?? 0) + 1;
        if (isViolation(severity)) total++;
    }

    return { nodes, edges, total };
};

// ── Hover "vitals" ──────────────────────────────────────────────────────────
// The colored block that leads the hover card. Built fresh from the live
// overlay each time it changes, so it never drifts from the measurements.

/**
 * @returns {Array<{ text: string, color?: string }>} lines, or [] when the
 *   node has no live electrical data.
 */
export const nodeVitals = (graph, live, nodeId) => {
    const summary = nodeVoltageSummary(graph, live, nodeId);
    if (!summary) {
        // Still show raw volts when there's a measurement but no usable base.
        const measured = live.nodes.get(nodeId);
        if (!measured?.voltage) return [];
        return Object.entries(measured.voltage).map(([phase, v]) => ({
            text: `${phase}  ${Number(v.magnitude).toFixed(1)} V`,
        }));
    }

    const lines = summary.phases.map(({ phase, magnitude, pu, severity }) => ({
        text: `${phase}  ${formatPu(pu)} p.u.  (${Number(magnitude).toFixed(0)} V)`,
        color: severity.color,
    }));

    const base = `${summary.base.toFixed(0)} V`;
    lines.push({
        text: summary.baseSource === "inferred" ? `base ${base} (inferred)` : `base ${base}`,
    });

    if (isViolation(summary.worst.severity)) {
        lines.unshift({
            text: `⚠ ${summary.worst.severity.label} on phase ${summary.worst.phase}`,
            color: summary.worst.severity.color,
        });
    }

    return lines;
};

/** @returns {Array<{ text: string, color?: string }>} */
export const edgeVitals = (graph, live, edgeId) => {
    const summary = edgeLoadingSummary(graph, live, edgeId);
    if (!summary) return [];

    const lines = [];

    if (summary.worst) {
        // The rating is per conductor, so the worst phase is what matters.
        lines.push({
            text: `Loading  ${formatPercent(summary.ratio)}  (${formatAmps(summary.worst.amps)} of ${formatAmps(summary.normalLimit)} on ${summary.worst.phase})`,
            color: summary.severity.color,
        });
    } else {
        lines.push({ text: `Flow  ${formatVA(summary.apparent)}` });
    }

    const measured = live.edges.get(edgeId);
    let real = 0;
    let imag = 0;
    for (const phase of Object.values(measured?.power ?? {})) {
        if (Number.isFinite(phase.real)) real += phase.real;
        if (Number.isFinite(phase.imag)) imag += phase.imag;
    }
    lines.push({ text: `P ${formatWatts(real, "W")}   Q ${formatWatts(imag, "VAr")}` });

    return lines;
};

/**
 * Recomputes a node's hover card in place so its vitals block matches the
 * current overlay. Always rebuilt from the node's own attributes, never
 * appended to, so the model's data stays untouched.
 */
export const refreshNodeHover = (graph, live, nodeId) => {
    if (!graph.hasNode(nodeId)) return;
    const vitals = nodeVitals(graph, live, nodeId);
    graph.updateNodeAttributes(nodeId, (node) => ({
        ...node,
        ...hoverPayload(node.attributes, vitals),
    }));
};
