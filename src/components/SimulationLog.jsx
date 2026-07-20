import { useEffect, useRef, useState } from "react";
import { Badge, Button, Empty, Tag, Tooltip, theme } from "antd";
import { IoChevronDown, IoChevronUp, IoTrashOutline } from "react-icons/io5";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";
import { useGraph } from "../contexts/GraphContext";
import "../styles/SimulationLog.css";

// GridAPPS-D log levels, most→least severe. Colors mirror the legacy
// gridappsd-viz status logger (antd Tag presets picked to read in both themes).
const LOG_LEVELS = ["FATAL", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"];
const LEVEL_COLOR = {
    FATAL: "red",
    ERROR: "volcano",
    WARN: "gold",
    INFO: "blue",
    DEBUG: "cyan",
    TRACE: "default",
};

// processStatus values GridAPPS-D reports for a simulation's lifecycle.
const STATUS_COLOR = {
    STARTING: "processing",
    STARTED: "processing",
    RUNNING: "success",
    PAUSED: "warning",
    COMPLETE: "default",
    CLOSED: "default",
    ERROR: "error",
};

const levelOf = (log) => (log.logLevel || "INFO").toUpperCase();

const timeOf = (log) => {
    // GridAPPS-D timestamps are epoch seconds; tolerate ms just in case.
    if (!log.timestamp) return "";
    const ms = log.timestamp > 1e12 ? log.timestamp : log.timestamp * 1000;
    return new Date(ms).toLocaleTimeString();
};

// expanded / onToggleExpanded are controlled by GraphLayout: collapsing the
// panel changes the graph's height, so the parent needs to re-fit sigma.
const SimulationLog = ({ expanded, onToggleExpanded }) => {
    const { darkMode } = useGraph();
    const { token } = theme.useToken();
    const [logs, setLogs] = useState(() => socketClientHelper.getSimulationLogs());
    const bodyRef = useRef(null);

    // Subscribe to live logs + the clear signal. Initial history comes from the
    // buffer (see useState initializer) so nothing is missed before mount.
    useEffect(() => {
        const unsubLog = socketClientHelper.on("sim-log", (log) => {
            setLogs((prev) => [...prev, log]);
        });
        const unsubClear = socketClientHelper.on("sim-log-clear", () => setLogs([]));
        return () => {
            unsubLog();
            unsubClear();
        };
    }, []);

    // Keep the newest line in view while expanded (only when already near the
    // bottom, so a user scrolled up to read history isn't yanked back down).
    useEffect(() => {
        if (!expanded) return;
        const el = bodyRef.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        if (nearBottom) el.scrollTop = el.scrollHeight;
    }, [logs, expanded]);

    return (
        <div className={`sim-log${darkMode ? " sim-log--dark" : ""}`}>
            <header className="sim-log__header">
                <button
                    type="button"
                    className="sim-log__toggle"
                    onClick={onToggleExpanded}
                    title={expanded ? "Minimize logs" : "Show logs"}
                >
                    {expanded ? <IoChevronDown size={14} /> : <IoChevronUp size={14} />}
                    <span className="sim-log__title">Simulation Status</span>
                    <Badge
                        count={logs.length}
                        overflowCount={9999}
                        showZero
                        color={token.colorPrimary}
                        style={{ marginLeft: 6 }}
                    />
                </button>

                <div className="sim-log__legend">
                    {LOG_LEVELS.map((level) => (
                        <Tag key={level} color={LEVEL_COLOR[level]} className="sim-log__legend-tag">
                            {level}
                        </Tag>
                    ))}
                </div>

                <Tooltip title="Clear logs">
                    <Button
                        type="text"
                        size="small"
                        icon={<IoTrashOutline />}
                        onClick={() => socketClientHelper.clearSimulationLogs()}
                    />
                </Tooltip>
            </header>

            {expanded && (
                <div className="sim-log__body" ref={bodyRef}>
                    {logs.length === 0 ? (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="Waiting for simulation logs…"
                            style={{ margin: "16px 0" }}
                        />
                    ) : (
                        logs.map((log, i) => {
                            const level = levelOf(log);
                            return (
                                <div key={i} className="sim-log__row">
                                    <span className="sim-log__time">{timeOf(log)}</span>
                                    <Tag color={LEVEL_COLOR[level] ?? "default"} className="sim-log__level">
                                        {level}
                                    </Tag>
                                    {log.processStatus && (
                                        <Tag
                                            color={STATUS_COLOR[log.processStatus] ?? "default"}
                                            className="sim-log__status"
                                        >
                                            {log.processStatus}
                                        </Tag>
                                    )}
                                    <span className="sim-log__message">
                                        {log.logMessage ?? JSON.stringify(log)}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default SimulationLog;
