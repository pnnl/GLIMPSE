import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Flex, Segmented, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useGraph } from "../../contexts/GraphContext";
import graphHelper from "../../graph-helper/GraphHelper";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import areaHighlight from "../../graph-helper/area-highlight";
import { AGENT_LEVELS, agentsByLevel } from "../../graph-helper/agents";
import { depthOfLevel, layoutAgentBuses } from "./agent-bus-layout";
import { NODE_COLORS, STATUS_COLORS, STROKE, surfaceFor } from "./agent-palette";

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 3;

const DEPTH_LABELS = {
    feeder: "Feeder",
    switch: "Switch areas",
    secondary: "Secondary",
};

// Below this many agents the whole hierarchy is legible at once, so the depth
// control starts fully open. Above it the diagram would be tens of thousands of
// pixels wide, and the useful first view is the top of the tree.
const SMALL_ROSTER = 60;

// SVG text doesn't wrap or ellipsize, so a long name would run over its
// neighbours. The caps are what fits a device chip at each of its two sizes.
const clip = (text, max) => {
    const value = text ?? "";
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

/**
 * The distributed-agent architecture for the loaded model: a stack of message
 * buses with the agents that sit on each and the field devices they carry.
 *
 * This is the same hierarchy the graph view highlights by area, drawn as the
 * layered picture the platform's own architecture diagrams use — the graph
 * answers "where in the grid", this answers "who talks to whom". Clicking an
 * agent goes back to the graph with that agent's area highlighted, which is what
 * ties the two views together.
 */
const AgentsView = () => {
    const { darkMode, setView } = useGraph();
    const [roster, setRoster] = useState(() => graphHelper.agents);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [expanded, setExpanded] = useState(() => new Set());
    const [devicesExpanded, setDevicesExpanded] = useState(() => new Set());
    const [depthLevel, setDepthLevel] = useState(null);
    const dragRef = useRef(null);
    const frameRef = useRef(null);

    useEffect(() => {
        // A new model means none of the old drill-down applies.
        const resetToRoster = () => {
            setRoster(graphHelper.agents);
            setExpanded(new Set());
            setDevicesExpanded(new Set());
            setDepthLevel(null);
        };

        // A liveness ping is not a new model. agents-update is how status arrives
        // for the roster already on screen, so clearing the user's drill-down and
        // depth on every one of them collapsed the diagram mid-interaction.
        const refreshRoster = () => setRoster(graphHelper.agents);

        window.addEventListener("graph-loaded", resetToRoster);
        window.addEventListener("graph-cleared", resetToRoster);
        const unsubscribe = socketClientHelper.on("agents-update", refreshRoster);

        return () => {
            window.removeEventListener("graph-loaded", resetToRoster);
            window.removeEventListener("graph-cleared", resetToRoster);
            unsubscribe();
        };
    }, []);

    // Only the levels this roster actually reaches can be drawn to.
    const levelsPresent = useMemo(() => {
        const byLevel = agentsByLevel(roster);
        return AGENT_LEVELS.filter((level) => level !== "system" && byLevel.has(level));
    }, [roster]);

    // A small model shows everything; a large one opens at the feeder so the
    // first view is readable rather than a hairline smear of switch areas.
    const defaultLevel = useMemo(() => {
        if (levelsPresent.length === 0) return null;
        return roster.agents.length <= SMALL_ROSTER
            ? levelsPresent[levelsPresent.length - 1]
            : levelsPresent[0];
    }, [levelsPresent, roster.agents.length]);

    const activeLevel = depthLevel && levelsPresent.includes(depthLevel) ? depthLevel : defaultLevel;

    // One switch area carries a dozen devices, and a bus is sized to hold its own
    // contents — so drawing every device is exactly what stretches those bars off
    // the screen. From the switch-area level down the devices start folded into a
    // chip per bus, and each bus opens on click.
    const collapseDevices = activeLevel === "switch" || activeLevel === "secondary";

    const layout = useMemo(
        () =>
            layoutAgentBuses(roster, {
                maxDepth: activeLevel ? depthOfLevel(activeLevel) : 0,
                expanded,
                collapseDevices,
                devicesExpanded,
            }),
        [roster, activeLevel, expanded, collapseDevices, devicesExpanded],
    );

    const c = surfaceFor(darkMode);

    const canvasRef = useRef(null);

    // Frame the whole diagram whenever its extent changes, so switching depth or
    // expanding a subtree never leaves the user staring at empty canvas.
    const fitToView = useCallback(() => {
        const box = canvasRef.current?.getBoundingClientRect();
        if (!box || layout.width === 0) return;

        const scale = Math.min(
            MAX_ZOOM,
            Math.max(MIN_ZOOM, Math.min(box.width / layout.width, box.height / layout.height, 1)),
        );
        setZoom(scale);
        setPan({ x: 0, y: 0 });
    }, [layout.width, layout.height]);

    // Re-frame only on changes the user made at the top level — a new roster, or a
    // new depth. Firing on every layout change meant expanding one device chip
    // reset zoom and pan and threw the diagram back to the top-left, mid-click.
    const fitToViewRef = useRef(fitToView);
    useLayoutEffect(() => {
        fitToViewRef.current = fitToView;
    }, [fitToView]);

    const hasExtent = layout.width > 0;
    useLayoutEffect(() => {
        if (hasExtent) fitToViewRef.current();
    }, [roster, depthLevel, hasExtent]);

    const onWheel = (e) => {
        // Trackpad and wheel both arrive here; a multiplicative step keeps the
        // zoom rate even across the range instead of crawling when zoomed out.
        const next = zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1);
        setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)));
    };

    const onPointerDown = (e) => {
        // Let clicks on agent boxes and chips through; only the canvas pans.
        if (e.target.closest("[data-interactive]")) return;
        dragRef.current = { x: e.clientX, y: e.clientY, pan };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
        const drag = dragRef.current;
        if (!drag) return;
        // Panning fires far faster than the screen refreshes; coalescing to one
        // frame keeps a large diagram from re-rendering several times per frame.
        if (frameRef.current) return;
        const { clientX, clientY } = e;
        frameRef.current = requestAnimationFrame(() => {
            frameRef.current = null;
            setPan({ x: drag.pan.x + (clientX - drag.x), y: drag.pan.y + (clientY - drag.y) });
        });
    };

    const onPointerUp = () => {
        dragRef.current = null;
    };

    useEffect(
        () => () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        },
        [],
    );

    const onAgentClick = (agent) => {
        if (agent.areaId) areaHighlight.select([agent.areaId]);
        setView("graph");
    };

    const toggleDevices = (busId) =>
        setDevicesExpanded((prev) => {
            const next = new Set(prev);
            if (!next.delete(busId)) next.add(busId);
            return next;
        });

    const revealChildren = (busId) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            next.add(busId);
            return next;
        });

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                background: c.bg,
                color: c.text,
            }}
        >
            <Flex
                align="center"
                gap={12}
                wrap
                style={{ padding: "8px 12px", borderBottom: `1px solid ${c.border}` }}
            >
                <Button icon={<ArrowLeftOutlined />} onClick={() => setView("graph")}>
                    Back to Graph
                </Button>
                <Typography.Title level={5} style={{ margin: 0, color: c.text }}>
                    Distributed Agents
                </Typography.Title>
                <Typography.Text style={{ color: c.sub, fontSize: 12 }}>
                    {roster.agents.length} agent{roster.agents.length === 1 ? "" : "s"}
                    {roster.source === "derived" && " · derived from the model"}
                </Typography.Text>

                {levelsPresent.length > 1 && (
                    <Flex align="center" gap={8} style={{ marginLeft: 16 }}>
                        <Typography.Text style={{ color: c.sub, fontSize: 12 }}>
                            Show down to
                        </Typography.Text>
                        <Segmented
                            size="small"
                            value={activeLevel}
                            onChange={(level) => {
                                setDepthLevel(level);
                                setExpanded(new Set());
                                setDevicesExpanded(new Set());
                            }}
                            options={levelsPresent.map((level) => ({
                                label: DEPTH_LABELS[level] ?? level,
                                value: level,
                            }))}
                        />
                    </Flex>
                )}

                <Button size="small" onClick={fitToView} style={{ marginLeft: "auto" }}>
                    Fit to view
                </Button>
            </Flex>

            {layout.buses.length === 0 ? (
                <Flex align="center" justify="center" style={{ flex: 1 }}>
                    <Empty
                        description={
                            <span style={{ color: c.sub }}>
                                No agents for this model. Load a CIM or GridAPPS-D model with
                                distribution areas.
                            </span>
                        }
                    />
                </Flex>
            ) : (
                <div
                    ref={canvasRef}
                    onWheel={onWheel}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    style={{ flex: 1, overflow: "hidden", cursor: "grab", touchAction: "none" }}
                >
                    <svg width="100%" height="100%" style={{ display: "block" }}>
                        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                            {/* Row labels, in the left gutter the layout reserves */}
                            {layout.rows.map((row) => (
                                <text
                                    key={row.level}
                                    x={24}
                                    y={row.y}
                                    fill={c.text}
                                    fontSize={13}
                                    fontWeight={700}
                                >
                                    {row.label.split("\n").map((line, i) => (
                                        <tspan key={line} x={24} dy={i === 0 ? 0 : 15}>
                                            {line}
                                        </tspan>
                                    ))}
                                </text>
                            ))}

                            {/* Message buses. Native <title> rather than an antd
                                Tooltip: antd's needs a ref-forwarding DOM child
                                and does not wrap SVG shapes reliably. */}
                            {layout.buses.map((bus) => (
                                <g key={bus.busId}>
                                    <rect
                                        x={bus.x}
                                        y={bus.y}
                                        width={bus.width}
                                        height={bus.height}
                                        rx={3}
                                        fill={NODE_COLORS.bus}
                                        stroke={STROKE}
                                        strokeWidth={1}
                                    >
                                        <title>{bus.name}</title>
                                    </rect>
                                    {/* Many switch-area buses look identical
                                        without this; the label tells them apart. */}
                                    <text x={bus.x} y={bus.y - 4} fill={c.sub} fontSize={10}>
                                        {bus.label}
                                    </text>

                                    {/* Devices folded into one chip; clicking
                                        opens just this bus's row. */}
                                    {bus.deviceChip && (
                                        <g
                                            data-interactive
                                            transform={`translate(${bus.deviceChip.x}, ${bus.deviceChip.y})`}
                                            onClick={() => toggleDevices(bus.busId)}
                                            style={{ cursor: "pointer" }}
                                        >
                                            <title>
                                                {bus.deviceChip.collapsed
                                                    ? `Show the ${bus.deviceChip.count} device(s) on ${bus.label}`
                                                    : `Hide the devices on ${bus.label}`}
                                            </title>
                                            <rect
                                                width={bus.deviceChip.width}
                                                height={bus.deviceChip.height}
                                                rx={11}
                                                fill={
                                                    bus.deviceChip.collapsed
                                                        ? NODE_COLORS.device
                                                        : c.hover
                                                }
                                                stroke={
                                                    bus.deviceChip.collapsed ? STROKE : c.border
                                                }
                                                strokeWidth={1}
                                            />
                                            <text
                                                x={bus.deviceChip.width / 2}
                                                y={bus.deviceChip.height / 2 + 1}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontSize={11}
                                                fill={bus.deviceChip.collapsed ? "#1f1f1f" : c.text}
                                            >
                                                {bus.deviceChip.collapsed
                                                    ? `${bus.deviceChip.count} device${bus.deviceChip.count === 1 ? "" : "s"}`
                                                    : "Hide devices"}
                                            </text>
                                        </g>
                                    )}

                                    {bus.chip && (
                                        <g
                                            data-interactive
                                            transform={`translate(${bus.chip.x}, ${bus.chip.y})`}
                                            onClick={() => revealChildren(bus.busId)}
                                            style={{ cursor: "pointer" }}
                                        >
                                            <title>
                                                {`Show ${bus.chip.count} more area(s) under ${bus.label}`}
                                            </title>
                                            <rect
                                                width={bus.chip.width}
                                                height={bus.chip.height}
                                                rx={11}
                                                fill={c.hover}
                                                stroke={c.border}
                                                strokeWidth={1}
                                            />
                                            <text
                                                x={bus.chip.width / 2}
                                                y={bus.chip.height / 2 + 1}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontSize={11}
                                                fill={c.text}
                                            >
                                                {/* "areas", not "more": the chip
                                                    sits under the device row and
                                                    would otherwise read as more
                                                    devices. */}
                                                {`+${bus.chip.count} areas`}
                                            </text>
                                        </g>
                                    )}
                                </g>
                            ))}

                            {/* Agents */}
                            {layout.agents.map(({ agent, x, y, width, height }) => (
                                <g
                                    key={agent.agentId || agent.areaId}
                                    data-interactive
                                    transform={`translate(${x}, ${y})`}
                                    onClick={() => onAgentClick(agent)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <title>
                                        {`${agent.agentId}\n${agent.areaName}\n${agent.devices.length} device(s) · ${agent.status}`}
                                    </title>
                                    <rect
                                        width={width}
                                        height={height}
                                        rx={3}
                                        fill={NODE_COLORS[agent.agentType] ?? NODE_COLORS.distributed}
                                        stroke={STROKE}
                                        strokeWidth={1}
                                    />
                                    <text
                                        x={width / 2}
                                        y={height / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fontSize={11}
                                        fill="#1f1f1f"
                                    >
                                        <tspan x={width / 2} dy={-6}>
                                            {agent.agentType === "coordinating"
                                                ? "Coordinating"
                                                : "Distributed"}
                                        </tspan>
                                        <tspan x={width / 2} dy={13}>
                                            Agent
                                        </tspan>
                                    </text>
                                    {/* Status pip, mirroring the panel and markers */}
                                    <circle
                                        cx={width - 8}
                                        cy={8}
                                        r={4}
                                        fill={STATUS_COLORS[agent.status] ?? STATUS_COLORS.unknown}
                                        stroke={STROKE}
                                        strokeWidth={0.75}
                                    />
                                </g>
                            ))}

                            {/* Devices */}
                            {layout.devices.map(({ device, busId, x, y, width, height }) => (
                                <g
                                    key={`${busId}-${device.mrid || device.name}`}
                                    transform={`translate(${x}, ${y})`}
                                >
                                    {/* The chip carries the name and CIM class;
                                        the role label and phases, which every
                                        chip of a kind shares, stay in the hover. */}
                                    <title>
                                        {[
                                            device.name,
                                            device.cimType,
                                            device.type,
                                            device.phases && `phases ${device.phases}`,
                                        ]
                                            .filter(Boolean)
                                            .join("\n")}
                                    </title>
                                    <rect
                                        width={width}
                                        height={height}
                                        rx={3}
                                        fill={NODE_COLORS.device}
                                        stroke={STROKE}
                                        strokeWidth={1}
                                    />
                                    <text
                                        x={width / 2}
                                        y={height / 2}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fill="#1f1f1f"
                                    >
                                        <tspan x={width / 2} dy={-4} fontSize={10} fontWeight={600}>
                                            {clip(device.name || device.mrid, 24)}
                                        </tspan>
                                        <tspan x={width / 2} dy={12} fontSize={9} fillOpacity={0.72}>
                                            {clip(device.cimType || device.type, 27)}
                                        </tspan>
                                    </text>
                                </g>
                            ))}
                        </g>
                    </svg>
                </div>
            )}
        </div>
    );
};

export default AgentsView;
