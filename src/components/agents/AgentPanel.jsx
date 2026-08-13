import { useEffect, useMemo, useState } from "react";
import { Segmented } from "antd";
import { IoChevronDown, IoChevronForward } from "react-icons/io5";
import { useGraph } from "../../contexts/GraphContext";
import graphHelper from "../../graph-helper/GraphHelper";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import useAreaHighlight from "../../hooks/useAreaHighlight";
import { AGENT_LEVELS, LEVEL_LABELS, agentsByLevel } from "../../graph-helper/agents";
import AgentMarkers from "./AgentMarkers";
import { STATUS_COLORS, surfaceFor } from "./agent-palette";

// Levels a marker can be placed at. "system" is excluded: the coordinating agent
// operates the whole model, so it has no area to sit on — it appears in the list
// and the bus diagram instead.
const PLACEABLE_LEVELS = AGENT_LEVELS.filter((level) => level !== "system");

const LEVEL_SHORT = { feeder: "Feeder", switch: "Switch", secondary: "Secondary" };

// Rows drawn per level before the list offers to show the rest. The 9500-bus
// model has ~1275 secondary agents, and mounting that many buttons makes opening
// the panel visibly stall.
const ROWS_PER_SECTION = 40;

// Module scope so React sees a stable component type across renders — the same
// reason LegendPanel keeps its Row/Section out of the render body.
const Row = ({ agent, c, selected, onSelect }) => (
    <button
        type="button"
        onClick={() => onSelect(agent)}
        title={`${agent.agentId}\n${agent.areaName}\n${agent.devices.length} device(s) · ${agent.status}`}
        style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "3px 8px",
            background: selected ? c.hover : "transparent",
            border: "none",
            borderRadius: 4,
            color: c.text,
            fontSize: 12,
            textAlign: "left",
            cursor: agent.areaId ? "pointer" : "default",
        }}
    >
        <span
            style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                flexShrink: 0,
                background: STATUS_COLORS[agent.status] ?? STATUS_COLORS.unknown,
            }}
        />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {agent.label || agent.agentId}
        </span>
        {agent.devices.length > 0 && (
            <span style={{ color: c.sub, fontSize: 10 }}>{agent.devices.length}</span>
        )}
    </button>
);

const Section = ({ title, agents, c, selection, onSelect, showAll, onShowAll }) => {
    const shown = showAll ? agents : agents.slice(0, ROWS_PER_SECTION);
    const remaining = agents.length - shown.length;

    return (
        <div style={{ marginBottom: 4 }}>
            <div
                style={{
                    padding: "4px 8px 2px",
                    color: c.sub,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                }}
            >
                {title} ({agents.length})
            </div>
            {shown.map((agent) => (
                <Row
                    key={agent.agentId || agent.areaId}
                    agent={agent}
                    c={c}
                    selected={selection.includes(agent.areaId)}
                    onSelect={onSelect}
                />
            ))}
            {remaining > 0 && (
                <button
                    type="button"
                    onClick={onShowAll}
                    style={{
                        width: "100%",
                        padding: "3px 8px",
                        background: "transparent",
                        border: "none",
                        color: c.sub,
                        fontSize: 11,
                        textAlign: "left",
                        cursor: "pointer",
                    }}
                >
                    Show {remaining} more…
                </button>
            )}
        </div>
    );
};

/**
 * The distributed-agent roster for the loaded model, grouped by the level of the
 * message bus each agent sits on, plus the level control for the on-graph
 * markers it renders.
 *
 * Clicking an agent highlights the distribution area it operates, using the same
 * shared selection the area tree drives — so the panel, the markers and the area
 * tree always agree on what is lit up.
 */
const AgentPanel = () => {
    const { darkMode } = useGraph();
    const areaHighlight = useAreaHighlight();
    const { selection } = areaHighlight;

    const [roster, setRoster] = useState(() => graphHelper.agents);
    // Collapsed on load: the panel is reference material, not the first thing to
    // read, and it shares the corner with the legend.
    const [expanded, setExpanded] = useState(false);
    // Feeder is the calm default. Starting at the switch level buries a large
    // model's graph under a hundred overlapping markers before the user has
    // asked for any of them.
    const [level, setLevel] = useState("feeder");
    const [expandedSections, setExpandedSections] = useState(() => new Set());

    useEffect(() => {
        const sync = () => {
            setRoster(graphHelper.agents);
            setExpandedSections(new Set());
        };

        window.addEventListener("graph-loaded", sync);
        window.addEventListener("graph-cleared", sync);
        // Live status: an external script or service reports which agents are up.
        const unsubscribe = socketClientHelper.on("agents-update", sync);

        return () => {
            window.removeEventListener("graph-loaded", sync);
            window.removeEventListener("graph-cleared", sync);
            unsubscribe();
        };
    }, []);

    const byLevel = useMemo(() => agentsByLevel(roster), [roster]);
    const levelsPresent = useMemo(
        () => PLACEABLE_LEVELS.filter((l) => byLevel.has(l)),
        [byLevel],
    );

    // A model whose areas stop above the current level would otherwise leave the
    // markers pointing at nothing.
    const activeLevel = levelsPresent.includes(level) ? level : levelsPresent[0];

    // Nothing to say when no roster has been loaded.
    if (roster.agents.length === 0) return null;

    const c = surfaceFor(darkMode);

    // The coordinating agent operates the whole model, so it has no area to
    // highlight; selecting it would be a no-op the controller ignores anyway.
    const onSelect = (agent) => {
        if (agent.areaId) areaHighlight.toggle(agent.areaId);
    };

    return (
        <>
            <AgentMarkers roster={roster} level={activeLevel} />

            <div
                style={{
                    width: 230,
                    marginTop: 8,
                    background: c.bg,
                    color: c.text,
                    border: `1px solid ${c.border}`,
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    overflow: "hidden",
                }}
            >
                <button
                    onClick={() => setExpanded((prev) => !prev)}
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 10px",
                        background: "transparent",
                        border: "none",
                        borderBottom: expanded ? `1px solid ${c.border}` : "none",
                        color: c.text,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    {expanded ? <IoChevronDown size={14} /> : <IoChevronForward size={14} />}
                    Agents
                    <span style={{ marginLeft: "auto", color: c.sub, fontWeight: 400, fontSize: 11 }}>
                        {roster.agents.length}
                    </span>
                </button>

                {expanded && (
                    <div style={{ maxHeight: 360, overflowY: "auto" }}>
                        {levelsPresent.length > 1 && (
                            <div style={{ padding: "8px 8px 4px" }}>
                                <div style={{ color: c.sub, fontSize: 10, marginBottom: 4 }}>
                                    Show markers for
                                </div>
                                <Segmented
                                    size="small"
                                    block
                                    value={activeLevel}
                                    onChange={setLevel}
                                    options={levelsPresent.map((l) => ({
                                        label: LEVEL_SHORT[l],
                                        value: l,
                                    }))}
                                />
                            </div>
                        )}

                        <div style={{ padding: "0 4px 6px" }}>
                            {[...byLevel.entries()].map(([lvl, agents]) => (
                                <Section
                                    key={lvl}
                                    title={LEVEL_LABELS[lvl] ?? lvl}
                                    agents={agents}
                                    c={c}
                                    selection={selection}
                                    onSelect={onSelect}
                                    showAll={expandedSections.has(lvl)}
                                    onShowAll={() =>
                                        setExpandedSections((prev) => new Set(prev).add(lvl))
                                    }
                                />
                            ))}

                            <div
                                style={{
                                    marginTop: 2,
                                    paddingTop: 6,
                                    borderTop: `1px solid ${c.border}`,
                                    padding: "6px 8px 2px",
                                    fontSize: 10,
                                    color: c.sub,
                                }}
                            >
                                Click an agent to highlight its area
                                {roster.source === "derived" && " · roster derived from the model"}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default AgentPanel;
