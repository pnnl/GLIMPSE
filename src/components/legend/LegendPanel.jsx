import { useState, useEffect, useCallback } from "react";
import { useSigma } from "@react-sigma/core";
import { IoChevronDown, IoChevronForward } from "react-icons/io5";
import graphHelper from "../../graph-helper/GraphHelper";
import ContextMenu from "../menus/ContextMenu";
import { useGraph } from "../../contexts/GraphContext";
import { panelHeaderStyle, panelStyle, surfaceFor } from "../agents/agent-palette";

// A DOM legend rendered inside a sigma ControlsContainer (so it has sigma context
// but its own toggle state lives inside the SigmaContainer — toggling it never
// re-renders GraphRenderer, so the graph is not reloaded). Lists the node/edge
// types present in the model with their color + count. Double-click a type to
// highlight it; right-click for a context menu (Hide All).
const key = (elementType, type) => `${elementType}:${type}`;

const MENU_ITEMS = [{ key: "hide-all", label: "Hide All" }];
const CLOSED_MENU = { open: false, x: 0, y: 0 };

// Row/Section live at module scope (not recreated per LegendPanel render) so
// React treats them as stable component types across renders.
const Row = ({ elementType, item, c, isOn, isHidden, onToggleHighlight, onOpenMenu }) => (
    <div
        onDoubleClick={() => onToggleHighlight(elementType, item.type)}
        onContextMenu={(e) => onOpenMenu(e, elementType, item.type)}
        title="Double-click to highlight · right-click for options"
        style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "3px 8px",
            borderRadius: 4,
            cursor: "pointer",
            userSelect: "none",
            background: isOn ? c.hover : "transparent",
            borderLeft: `3px solid ${isOn ? c.accent : "transparent"}`,
            opacity: isHidden ? 0.45 : 1,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = c.hover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = isOn ? c.hover : "transparent")}
    >
        {/* Swatch: circle for nodes, bar for edges */}
        {elementType === "node" ? (
            <span
                style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: item.color,
                    border: `1px solid ${item.borderColor}`,
                }}
            />
        ) : (
            <span style={{ width: 14, height: 4, borderRadius: 2, flexShrink: 0, background: item.color }} />
        )}
        <span
            style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontWeight: isOn ? 600 : 400,
                textDecoration: isHidden ? "line-through" : "none",
            }}
        >
            {item.type}
        </span>
        <span style={{ color: c.sub, fontVariantNumeric: "tabular-nums" }}>{item.count}</span>
    </div>
);

const Section = ({ title, elementType, items, c, highlighted, hidden, onToggleHighlight, onOpenMenu }) =>
    items.length === 0 ? null : (
        <div>
            <div
                style={{
                    padding: "6px 8px 2px",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    color: c.sub,
                }}
            >
                {title}
            </div>
            {items.map((item) => (
                <Row
                    key={item.type}
                    elementType={elementType}
                    item={item}
                    c={c}
                    isOn={highlighted.has(key(elementType, item.type))}
                    isHidden={hidden.has(key(elementType, item.type))}
                    onToggleHighlight={onToggleHighlight}
                    onOpenMenu={onOpenMenu}
                />
            ))}
        </div>
    );

const LegendPanel = () => {
    const sigma = useSigma();
    const { darkMode } = useGraph();

    // Collapsed on load so the corner starts quiet: this and the agent panel
    // share it, and neither is the first thing to read on a fresh model.
    const [expanded, setExpanded] = useState(false);
    // Initialized straight from the graph — it's already loaded when this
    // mounts inside the SigmaContainer; load/clear events keep it in sync.
    const [data, setData] = useState(() => graphHelper.getLegendData());
    const [highlighted, setHighlighted] = useState(() => new Set());
    const [hidden, setHidden] = useState(() => new Set());
    const [context, setContext] = useState(CLOSED_MENU);

    const refresh = useCallback(() => setData(graphHelper.getLegendData()), []);

    // Re-read on graph load/clear; wipe local highlight/hide state since the graph
    // (and graphHelper's highlight sets) reset with it.
    useEffect(() => {
        const clearMarks = () => {
            setHighlighted(new Set());
            setHidden(new Set());
        };
        const handleGraphLoaded = () => {
            refresh();
            clearMarks();
        };
        const handleGraphCleared = () => {
            setData({ nodes: [], edges: [] });
            clearMarks();
        };

        window.addEventListener("graph-loaded", handleGraphLoaded);
        window.addEventListener("graph-cleared", handleGraphCleared);
        // The Reset button clears highlight/hide on the graph; mirror it here.
        window.addEventListener("graph-reset", clearMarks);
        // Light/dark toggle re-flattens the theme's color pairs, so the swatches
        // need re-reading. Driven by the event rather than darkMode because
        // GraphRenderer's effect (which runs after this panel renders) is what
        // calls graphHelper.setDarkMode.
        window.addEventListener("graph-theme-changed", refresh);
        return () => {
            window.removeEventListener("graph-loaded", handleGraphLoaded);
            window.removeEventListener("graph-cleared", handleGraphCleared);
            window.removeEventListener("graph-reset", clearMarks);
            window.removeEventListener("graph-theme-changed", refresh);
        };
    }, [refresh]);

    // Close the context menu on any outside interaction while it's open. Guard
    // against clicks inside the menu itself, or the menu would unmount on mousedown
    // before its item's click handler could run.
    useEffect(() => {
        if (!context.open) return;
        const close = (e) => {
            if (e.target.closest?.("[data-legend-menu]")) return;
            setContext(CLOSED_MENU);
        };
        window.addEventListener("mousedown", close);
        return () => window.removeEventListener("mousedown", close);
    }, [context.open]);

    const toggleExpanded = () => {
        setExpanded((prev) => {
            if (!prev) refresh(); // opening: pick up any count changes (e.g. mid-sim)
            return !prev;
        });
    };

    const toggleHighlight = (elementType, type) => {
        if (elementType === "node") graphHelper.highlightGroup(type);
        else graphHelper.highlightEdgeTypes(type);
        sigma.refresh();

        setHighlighted((prev) => {
            const next = new Set(prev);
            const k = key(elementType, type);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
        });
    };

    const openMenu = (e, elementType, type) => {
        e.preventDefault();
        setContext({ open: true, type: elementType, group: type, x: e.pageX, y: e.pageY });
    };

    // "Hide All" is the menu's only item.
    const hideAll = () => {
        graphHelper.hideGroup(context.type, context.group);
        sigma.refresh();
        setHidden((prev) => new Set(prev).add(key(context.type, context.group)));
        setContext(CLOSED_MENU);
    };

    const c = { ...surfaceFor(darkMode), accent: darkMode ? "#4c8bf5" : "#1677ff" };

    const isEmpty = data.nodes.length === 0 && data.edges.length === 0;

    return (
        <div style={panelStyle(c)}>
            <button onClick={toggleExpanded} style={panelHeaderStyle(c, expanded)}>
                {expanded ? <IoChevronDown size={14} /> : <IoChevronForward size={14} />}
                Legend
            </button>

            {expanded && (
                <div style={{ maxHeight: 360, overflowY: "auto", padding: "4px 4px 6px" }}>
                    {isEmpty ? (
                        <div style={{ padding: "10px 8px", color: c.sub }}>No model loaded.</div>
                    ) : (
                        <>
                            <Section
                                title="Nodes"
                                elementType="node"
                                items={data.nodes}
                                c={c}
                                highlighted={highlighted}
                                hidden={hidden}
                                onToggleHighlight={toggleHighlight}
                                onOpenMenu={openMenu}
                            />
                            <Section
                                title="Edges"
                                elementType="edge"
                                items={data.edges}
                                c={c}
                                highlighted={highlighted}
                                hidden={hidden}
                                onToggleHighlight={toggleHighlight}
                                onOpenMenu={openMenu}
                            />
                            <div
                                style={{
                                    marginTop: 6,
                                    borderTop: `1px solid ${c.border}`,
                                    padding: "6px 8px 2px",
                                    fontSize: 10,
                                    color: c.sub,
                                }}
                            >
                                Double-click a type to highlight · right-click for options
                            </div>
                        </>
                    )}
                </div>
            )}

            <ContextMenu
                data-legend-menu
                context={context}
                width="8rem"
                items={MENU_ITEMS}
                onClick={hideAll}
            />
        </div>
    );
};

export default LegendPanel;
