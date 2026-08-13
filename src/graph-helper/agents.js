// The distributed-agent roster, as served by /api/gridappsd/agents.
//
// GridAPPS-D addresses each agent by its `message_bus_id`, which is the mRID of
// the distribution area it operates — the same id the graph already carries on
// every node and edge as feeder_area_id / switch_area_id / secondary_area_id. So
// an agent is placed on the visualization by a direct id match, and the existing
// area highlighting is what draws it.
//
// This module owns the shape of that roster on the client: it normalizes what
// came off the wire once, then answers the questions the panel, the on-graph
// chips and the bus diagram each ask of it. It holds no React state — like the
// rest of graph-helper it hangs off the graphHelper singleton and components
// re-read it when a `graph-loaded` or `agents-update` event tells them to.

// General -> specific. Matches the backend's LEVELS plus the system bus that
// sits above every model-derived area.
export const AGENT_LEVELS = ["system", "feeder", "switch", "secondary"];

// Human labels for the bus rows of the diagram and the panel's section headers.
export const LEVEL_LABELS = {
    system: "Distribution System",
    feeder: "Feeder",
    switch: "Switch Area",
    secondary: "Distribution Secondary",
};

// What to call an area of each level in the UI, once its id-like name has been
// reduced to the part that distinguishes it.
const LEVEL_TITLES = {
    system: "Distribution System",
    feeder: "Feeder",
    switch: "Switch Area",
    secondary: "Secondary",
};

const EMPTY = { model: null, source: null, buses: [], agents: [] };

/**
 * A label short enough to read in a 240px panel or on a marker.
 *
 * CIM names distribution areas by extending their parent's name — a feeder's
 * switch areas come out as "<36-char feeder mRID>.0" through ".5". Those differ
 * only in their last character, so shown raw they all ellipsize to the same
 * string and the UI looks like it is repeating one area. Dropping the parent's
 * prefix leaves exactly the part that identifies the area.
 *
 * Falls back to the full name for any model that doesn't follow that convention.
 */
const shortAreaLabel = (name, parentName, level) => {
    const title = LEVEL_TITLES[level] ?? level;
    if (level === "system") return title;

    let tail = name ?? "";
    if (parentName && tail.startsWith(parentName)) {
        tail = tail.slice(parentName.length).replace(/^[.\-_\s]+/, "");
    }

    // Nothing left to distinguish it by (a feeder area named after its feeder),
    // so the level alone is the clearest thing to show.
    if (!tail || tail === name) return name && name.length <= 24 ? name : title;

    return `${title} ${tail}`;
};

/**
 * Coerces a payload — from the REST endpoint or from an `agents-update` socket
 * broadcast — into the roster shape. The backend already guarantees this, but a
 * socket payload comes from an arbitrary external script, so nothing here may
 * assume well-formed input.
 */
export const normalizeRoster = (payload) => {
    if (!payload || typeof payload !== "object") return { ...EMPTY };

    const agents = Array.isArray(payload.agents) ? payload.agents.filter(Boolean) : [];
    const rawBuses = Array.isArray(payload.buses) ? payload.buses.filter(Boolean) : [];

    const buses = rawBuses.map((bus) => ({
        busId: bus.bus_id ?? bus.busId ?? "",
        level: AGENT_LEVELS.includes(bus.level) ? bus.level : "switch",
        name: bus.name ?? "",
        areaId: bus.area_id ?? bus.areaId ?? null,
        parentBusId: bus.parent_bus_id ?? bus.parentBusId ?? null,
    }));

    // Short labels need each area's parent, so they're resolved here, once,
    // rather than by each of the three components that display them.
    const busById = new Map(buses.map((bus) => [bus.busId, bus]));
    const parentNameOf = (busId) => {
        const bus = busById.get(busId);
        return bus ? (busById.get(bus.parentBusId)?.name ?? null) : null;
    };

    buses.forEach((bus) => {
        bus.label = shortAreaLabel(bus.name, parentNameOf(bus.busId), bus.level);
    });

    return {
        model: payload.model ?? null,
        source: payload.source ?? null,
        buses,
        agents: agents.map((agent) => {
            const level = AGENT_LEVELS.includes(agent.level) ? agent.level : "switch";
            const areaName = agent.area_name ?? agent.areaName ?? "";
            const busId = agent.message_bus_id ?? agent.messageBusId ?? null;

            return {
                agentId: agent.agent_id ?? agent.agentId ?? "",
                agentType: agent.agent_type ?? agent.agentType ?? "distributed",
                level,
                messageBusId: busId,
                areaId: agent.area_id ?? agent.areaId ?? null,
                areaName,
                label: shortAreaLabel(areaName, parentNameOf(busId), level),
                status: agent.status ?? "unknown",
                devices: Array.isArray(agent.devices) ? agent.devices : [],
            };
        }),
    };
};

/**
 * The roster split by level, in general -> specific order, with empty levels
 * dropped. Both the panel's sections and the diagram's bus rows are built from
 * this, so they can never disagree about which levels exist.
 */
export const agentsByLevel = (roster) => {
    const byLevel = new Map();

    AGENT_LEVELS.forEach((level) => {
        const agents = roster.agents.filter((agent) => agent.level === level);
        if (agents.length > 0) byLevel.set(level, agents);
    });

    return byLevel;
};

/** The agent operating a given distribution area, or null. */
export const agentForArea = (roster, areaId) =>
    roster.agents.find((agent) => agent.areaId === areaId) ?? null;

/**
 * Applies a status-only update without discarding the roster.
 *
 * An `agents-update` broadcast is usually a liveness report, not a new roster —
 * it names agents and their state. Merging by agent id keeps the areas, names
 * and device lists that the (much richer) REST payload established, so a status
 * ping can't blank out the diagram.
 */
export const mergeRoster = (roster, payload) => {
    const incoming = normalizeRoster(payload);
    if (incoming.agents.length === 0) return roster;

    // A payload that brings its own buses is a full roster; take it wholesale.
    if (incoming.buses.length > 0) return incoming;

    const updates = new Map(incoming.agents.map((agent) => [agent.agentId, agent]));
    const merged = roster.agents.map((agent) => {
        const update = updates.get(agent.agentId);
        if (!update) return agent;
        updates.delete(agent.agentId);
        return { ...agent, status: update.status };
    });

    // Agents the roster didn't know about are still worth showing.
    return { ...roster, agents: [...merged, ...updates.values()] };
};

export const emptyRoster = () => ({ ...EMPTY });
