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

export const agentsByLevel = (roster) => {
    const byLevel = new Map();

    AGENT_LEVELS.forEach((level) => {
        const agents = roster.agents.filter((agent) => agent.level === level);
        if (agents.length > 0) byLevel.set(level, agents);
    });

    return byLevel;
};

export const agentForArea = (roster, areaId) =>
    roster.agents.find((agent) => agent.areaId === areaId) ?? null;

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
