import { useEffect, useRef, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";
import { useGraph } from "../contexts/GraphContext";
import "../styles/SimulationCharts.css";

const MAX_POINTS = 20;
const LOAD_TYPES = new Set(["EnergyConsumer", "ConformLoad", "NonConformLoad"]);

function polarToRect(magnitude, angleDeg) {
    if (!isFinite(magnitude) || !isFinite(angleDeg)) return [0, 0];
    const rad = (angleDeg * Math.PI) / 180;
    return [magnitude * Math.cos(rad), magnitude * Math.sin(rad)];
}

const SimulationCharts = () => {
    const { darkMode } = useGraph();

    const vd = useRef({ timestamps: [], min: [], avg: [], max: [] });
    const ld = useRef({
        timestamps: [],
        loadP: [],
        loadQ: [],
        batP: [],
        batQ: [],
        solP: [],
        solQ: [],
    });

    const voltageChartRef = useRef(null);
    const loadChartRef = useRef(null);

    const processOutput = useCallback((output) => {
        const { timestamp, Analog } = output;
        const ts = new Date(timestamp * 1000).toLocaleTimeString();

        // ── Voltage (PNV) ──────────────────────────────────────────────────
        const pnvMags = Analog.filter((m) => m.measurement_type === "PNV")
            .map((m) => m.magnitude)
            .filter(isFinite);

        if (pnvMags.length > 0) {
            const minV = Math.min(...pnvMags);
            const maxV = Math.max(...pnvMags);
            const avgV = pnvMags.reduce((a, b) => a + b, 0) / pnvMags.length;
            const v = vd.current;
            v.timestamps.push(ts);
            v.min.push(parseFloat(minV.toFixed(2)));
            v.avg.push(parseFloat(avgV.toFixed(2)));
            v.max.push(parseFloat(maxV.toFixed(2)));
            if (v.timestamps.length > MAX_POINTS) {
                v.timestamps.shift();
                v.min.shift();
                v.avg.shift();
                v.max.shift();
            }
            voltageChartRef.current?.getEchartsInstance()?.setOption({
                xAxis: { data: [...v.timestamps] },
                series: [{ data: [...v.min] }, { data: [...v.avg] }, { data: [...v.max] }],
            });
        }

        // ── Load Demand (VA) ───────────────────────────────────────────────
        let lP = 0,
            lQ = 0,
            bP = 0,
            bQ = 0,
            sP = 0,
            sQ = 0;
        for (const m of Analog.filter((m) => m.measurement_type === "VA")) {
            const [P, Q] = polarToRect(m.magnitude, m.angle);
            const name = m.equipment_name || "";
            if (LOAD_TYPES.has(m.equipment_type)) {
                lP += P;
                lQ += Q;
            } else if (name.startsWith("PowerElectronicsConnection_BatteryUnit")) {
                bP += P;
                bQ += Q;
            } else if (name.startsWith("PowerElectronicsConnection_PhotovoltaicUnit")) {
                sP += P;
                sQ += Q;
            }
        }

        const l = ld.current;
        const push = (arr, val) => {
            arr.push(parseFloat((val / 1000).toFixed(3)));
            if (arr.length > MAX_POINTS) arr.shift();
        };
        l.timestamps.push(ts);
        if (l.timestamps.length > MAX_POINTS) l.timestamps.shift();
        push(l.loadP, lP);
        push(l.loadQ, lQ);
        push(l.batP, bP);
        push(l.batQ, bQ);
        push(l.solP, sP);
        push(l.solQ, sQ);

        loadChartRef.current?.getEchartsInstance()?.setOption({
            xAxis: { data: [...l.timestamps] },
            series: [
                { data: [...l.loadP] },
                { data: [...l.loadQ] },
                { data: [...l.batP] },
                { data: [...l.batQ] },
                { data: [...l.solP] },
                { data: [...l.solQ] },
            ],
        });
    }, []);

    useEffect(() => {
        return socketClientHelper.on("sim-output", processOutput);
    }, [processOutput]);

    // ── ECharts theme helpers ──────────────────────────────────────────────
    const text = darkMode ? "#cccccc" : "#333333";
    const bg = darkMode ? "#1f1f1f" : "#fafafa";
    const gridLine = darkMode ? "#2e2e2e" : "#ebebeb";

    const sharedGrid = { left: 52, right: 10, top: 38, bottom: 42 };
    const xAxisBase = {
        type: "category",
        axisLabel: { color: text, fontSize: 8, rotate: 30, interval: "auto" },
        splitLine: { lineStyle: { color: gridLine } },
        axisTick: { show: false },
    };
    const yAxisBase = (name) => ({
        type: "value",
        name,
        nameTextStyle: { color: text, fontSize: 9 },
        axisLabel: { color: text, fontSize: 8 },
        splitLine: { lineStyle: { color: gridLine } },
    });
    const legendBase = {
        top: 4,
        textStyle: { color: text, fontSize: 9 },
        itemWidth: 14,
        itemHeight: 7,
    };

    const line = (name, color, dashed = false) => ({
        name,
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { color, width: 1.5, ...(dashed ? { type: "dashed" } : {}) },
        itemStyle: { color },
    });

    // Always embed the current accumulated data so a re-render (e.g. dark mode
    // toggle) never sends empty series that would wipe the live chart lines.
    const v = vd.current;
    const l = ld.current;

    const voltageOption = {
        backgroundColor: bg,
        textStyle: { color: text },
        grid: sharedGrid,
        tooltip: { trigger: "axis", confine: true, textStyle: { fontSize: 10 } },
        legend: { ...legendBase, data: ["Min", "Avg", "Max"] },
        xAxis: { ...xAxisBase, data: [...v.timestamps] },
        yAxis: yAxisBase("V"),
        series: [
            { ...line("Min", "#5470c6"), data: [...v.min] },
            { ...line("Avg", "#91cc75"), data: [...v.avg] },
            { ...line("Max", "#ee6666"), data: [...v.max] },
        ],
    };

    const loadOption = {
        backgroundColor: bg,
        textStyle: { color: text },
        grid: sharedGrid,
        tooltip: { trigger: "axis", confine: true, textStyle: { fontSize: 10 } },
        legend: { ...legendBase, data: ["Load P", "Load Q", "Bat P", "Bat Q", "Sol P", "Sol Q"] },
        xAxis: { ...xAxisBase, data: [...l.timestamps] },
        yAxis: yAxisBase("kVA"),
        series: [
            { ...line("Load P", "#5470c6"), data: [...l.loadP] },
            { ...line("Load Q", "#5470c6", true), data: [...l.loadQ] },
            { ...line("Bat P", "#91cc75"), data: [...l.batP] },
            { ...line("Bat Q", "#91cc75", true), data: [...l.batQ] },
            { ...line("Sol P", "#fac858"), data: [...l.solP] },
            { ...line("Sol Q", "#fac858", true), data: [...l.solQ] },
        ],
    };

    return (
        <div className="sim-charts" style={{ backgroundColor: bg }}>
            <div className="sim-charts__label" style={{ color: text }}>
                Voltage
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
