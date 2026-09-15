import { useEffect, useRef, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";
import { useGraph } from "../contexts/GraphContext";
import { trimHistory, useChartTimeline } from "../hooks/useChartTimeline";
import LiveButton from "./plots/LiveButton";
import { baseChartOption, chartColors } from "./plots/plotConstants";
import "../styles/SimulationCharts.css";

const LOAD_TYPES = new Set(["EnergyConsumer", "ConformLoad", "NonConformLoad"]);
const LOAD_KEYS = ["loadP", "loadQ", "batP", "batQ", "solP", "solQ"];

const emptyVoltage = () => ({ timestamps: [], min: [], avg: [], max: [] });
const emptyLoad = () => ({ timestamps: [], ...Object.fromEntries(LOAD_KEYS.map((key) => [key, []])) });

function polarToRect(magnitude, angleDeg) {
    if (!isFinite(magnitude) || !isFinite(angleDeg)) return [0, 0];
    const rad = (angleDeg * Math.PI) / 180;
    return [magnitude * Math.cos(rad), magnitude * Math.sin(rad)];
}

// Which load-demand series ("load" | "bat" | "sol") a VA measurement feeds, or null.
const loadCategory = (m) => {
    if (LOAD_TYPES.has(m.equipment_type)) return "load";
    const name = m.equipment_name || "";
    if (name.startsWith("PowerElectronicsConnection_BatteryUnit")) return "bat";
    if (name.startsWith("PowerElectronicsConnection_PhotovoltaicUnit")) return "sol";
    return null;
};

const line = (name, color, dashed = false) => ({
    name,
    type: "line",
    smooth: true,
    showSymbol: false,
    lineStyle: { color, width: 1.5, ...(dashed ? { type: "dashed" } : {}) },
    itemStyle: { color },
});

const SimulationCharts = () => {
    const { darkMode } = useGraph();

    const vd = useRef(emptyVoltage());
    const ld = useRef(emptyLoad());

    const voltageChartRef = useRef(null);
    const loadChartRef = useRef(null);

    const renderVoltage = useCallback(() => {
        const v = vd.current;
        voltageChartRef.current?.getEchartsInstance()?.setOption({
            xAxis: { data: [...v.timestamps] },
            series: [{ data: [...v.min] }, { data: [...v.avg] }, { data: [...v.max] }],
        });
    }, []);

    const renderLoad = useCallback(() => {
        const l = ld.current;
        loadChartRef.current?.getEchartsInstance()?.setOption({
            xAxis: { data: [...l.timestamps] },
            series: LOAD_KEYS.map((key) => ({ data: [...l[key]] })),
        });
    }, []);

    // Each chart owns its own scroll position, so the two timelines are
    // independent — scrolling back through voltage doesn't move load demand.
    const clearVoltage = useCallback(() => {
        vd.current = emptyVoltage();
        renderVoltage();
    }, [renderVoltage]);

    const clearLoad = useCallback(() => {
        ld.current = emptyLoad();
        renderLoad();
    }, [renderLoad]);

    const voltageTimeline = useChartTimeline(
        voltageChartRef,
        useCallback(() => vd.current.timestamps.length, []),
        clearVoltage,
    );
    const loadTimeline = useChartTimeline(
        loadChartRef,
        useCallback(() => ld.current.timestamps.length, []),
        clearLoad,
    );

    const syncVoltage = voltageTimeline.syncWindow;
    const syncLoad = loadTimeline.syncWindow;

    const processOutput = useCallback(
        (output) => {
            const { timestamp } = output ?? {};
            // Matches CustomPlot: a frame can arrive without Analog.
            const Analog = Array.isArray(output?.Analog) ? output.Analog : [];
            const ts = new Date(timestamp * 1000).toLocaleTimeString();

            // ── Voltage (PNV) ──────────────────────────────────────────────────
            const pnvMags = Analog.filter((m) => m.measurement_type === "PNV")
                .map((m) => m.magnitude)
                .filter(isFinite);

            if (pnvMags.length > 0) {
                const avgV = pnvMags.reduce((a, b) => a + b, 0) / pnvMags.length;
                const v = vd.current;
                v.timestamps.push(ts);
                v.min.push(parseFloat(Math.min(...pnvMags).toFixed(2)));
                v.avg.push(parseFloat(avgV.toFixed(2)));
                v.max.push(parseFloat(Math.max(...pnvMags).toFixed(2)));
                // Trimmed only at the retention cap — the run's history is kept so
                // it can be scrolled back through.
                [v.timestamps, v.min, v.avg, v.max].forEach(trimHistory);

                renderVoltage();
                syncVoltage();
            }

            // ── Load Demand (VA) ───────────────────────────────────────────────
            const sums = Object.fromEntries(LOAD_KEYS.map((key) => [key, 0]));
            for (const m of Analog) {
                if (m.measurement_type !== "VA") continue;
                const category = loadCategory(m);
                if (!category) continue;
                const [P, Q] = polarToRect(m.magnitude, m.angle);
                sums[`${category}P`] += P;
                sums[`${category}Q`] += Q;
            }

            const l = ld.current;
            l.timestamps.push(ts);
            trimHistory(l.timestamps);
            for (const key of LOAD_KEYS) {
                l[key].push(parseFloat((sums[key] / 1000).toFixed(3)));
                trimHistory(l[key]);
            }

            renderLoad();
            syncLoad();
        },
        [renderVoltage, renderLoad, syncVoltage, syncLoad],
    );

    useEffect(() => {
        return socketClientHelper.on("sim-output", processOutput);
    }, [processOutput]);

    useEffect(() => {
        if (vd.current.timestamps.length === 0 && ld.current.timestamps.length === 0) return;

        renderVoltage();
        renderLoad();
        syncVoltage();
        syncLoad();
    }, [renderVoltage, renderLoad, syncVoltage, syncLoad]);

    const { text, bg } = chartColors(darkMode);

    const voltageOption = {
        ...baseChartOption(darkMode, { legend: ["Min", "Avg", "Max"], yAxis: { name: "V" } }),
        series: [line("Min", "#5470c6"), line("Avg", "#91cc75"), line("Max", "#ee6666")],
    };

    const loadOption = {
        ...baseChartOption(darkMode, {
            legend: ["Load P", "Load Q", "Bat P", "Bat Q", "Sol P", "Sol Q"],
            yAxis: { name: "kVA" },
        }),
        series: [
            line("Load P", "#5470c6"),
            line("Load Q", "#5470c6", true),
            line("Bat P", "#91cc75"),
            line("Bat Q", "#91cc75", true),
            line("Sol P", "#fac858"),
            line("Sol Q", "#fac858", true),
        ],
    };

    return (
        <div className="sim-charts" style={{ backgroundColor: bg }}>
            <div className="sim-charts__label" style={{ color: text }}>
                Voltage
                <LiveButton
                    following={voltageTimeline.isFollowing}
                    onResume={voltageTimeline.resumeFollowing}
                />
            </div>
            <ReactECharts
                ref={voltageChartRef}
                option={voltageOption}
                style={{ flex: 1, minHeight: 0 }}
                notMerge={false}
                lazyUpdate
            />
            <div className="sim-charts__label" style={{ color: text }}>
                Load Demand
                <LiveButton
                    following={loadTimeline.isFollowing}
                    onResume={loadTimeline.resumeFollowing}
                />
            </div>
            <ReactECharts
                ref={loadChartRef}
                option={loadOption}
                style={{ flex: 1, minHeight: 0 }}
                notMerge={false}
                lazyUpdate
            />
        </div>
    );
};

export default SimulationCharts;
