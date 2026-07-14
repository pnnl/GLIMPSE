import { useEffect, useRef, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import { useGraph } from "../../contexts/GraphContext";
import { MEASUREMENT_TYPE } from "./plotConstants";

const MAX_POINTS = 20;

// Series color palette (same hues the default charts use).
const PALETTE = ["#5470c6", "#91cc75", "#ee6666", "#fac858", "#73c0de", "#3ba272", "#fc8452", "#9a60b4"];

// Y-axis label per plot, mirroring the legacy MeasurementChartContainer.
const yAxisLabel = (plot) => {
    switch (plot.measurementType) {
        case MEASUREMENT_TYPE.VOLTAGE:
            return plot.valueKind === "angle" ? "deg" : "V";
        case MEASUREMENT_TYPE.POWER:
            return plot.valueKind === "angle" ? "deg" : "kVA";
        case MEASUREMENT_TYPE.TAP:
            return "tap";
        default:
            return "";
    }
};

// Pull the plotted scalar out of a single measurement, matching the legacy
// _getNextMeasurementValue: voltage/power use magnitude (power in kVA) or angle,
// tap uses the discrete value.
const extractValue = (plot, measurement) => {
    if (!measurement) return null;
    switch (plot.measurementType) {
        case MEASUREMENT_TYPE.VOLTAGE:
            return plot.valueKind === "angle" ? measurement.angle : measurement.magnitude;
        case MEASUREMENT_TYPE.POWER:
            return plot.valueKind === "angle" ? measurement.angle : measurement.magnitude / 1000;
        case MEASUREMENT_TYPE.TAP:
            return measurement.value;
        default:
            return null;
    }
};

const CustomPlot = ({ plot, onRemove }) => {
    const { darkMode } = useGraph();
    const chartRef = useRef(null);

    // Rolling buffers: shared x (timestamps) + one y array per component/phase.
    const data = useRef({ timestamps: [], series: plot.components.map(() => []) });

    const processOutput = useCallback(
        (output) => {
            const ts = new Date(output.timestamp * 1000).toLocaleTimeString();

            // Index every incoming measurement by its mRID so each plotted
            // component can look up its own value regardless of ordering. Tap
            // (Pos) measurements arrive as Discrete, voltage/power as Analog.
            const byMrid = new Map();
            for (const m of [...(output.Analog ?? []), ...(output.Discrete ?? [])]) {
                if (m.measurement_mrid) byMrid.set(m.measurement_mrid, m);
            }

            const d = data.current;
            d.timestamps.push(ts);
            if (d.timestamps.length > MAX_POINTS) d.timestamps.shift();

            plot.components.forEach((component, i) => {
                const value = extractValue(plot, byMrid.get(component.id));
                const arr = d.series[i];
                // Carry forward the previous value when a component reports nothing
                // this step so line lengths stay aligned with the timestamp axis.
                const next = value === null || value === undefined || !isFinite(value)
                    ? arr.length > 0 ? arr[arr.length - 1] : null
                    : parseFloat(Number(value).toFixed(3));
                arr.push(next);
                if (arr.length > MAX_POINTS) arr.shift();
            });

            chartRef.current?.getEchartsInstance()?.setOption({
                xAxis: { data: [...d.timestamps] },
                series: d.series.map((arr) => ({ data: [...arr] })),
            });
        },
        [plot],
    );

    useEffect(() => {
        return socketClientHelper.on("sim-output", processOutput);
    }, [processOutput]);

    // ── ECharts theming (matches SimulationCharts) ─────────────────────────
    // The declarative option deliberately omits every `data` field. ReactECharts
    // re-applies this option (merge mode) on each render — e.g. a dark-mode toggle
    // — and because the accumulated point data lives only in the imperative
    // setOption calls above, leaving `data` out here preserves the live series
    // instead of wiping them, all without reading the ref during render.
    const text = darkMode ? "#cccccc" : "#333333";
    const bg = darkMode ? "#1f1f1f" : "#fafafa";
    const gridLine = darkMode ? "#2e2e2e" : "#ebebeb";

    const option = {
        backgroundColor: bg,
        textStyle: { color: text },
        grid: { left: 52, right: 10, top: 38, bottom: 42 },
        tooltip: { trigger: "axis", confine: true, textStyle: { fontSize: 10 } },
        legend: {
            top: 4,
            textStyle: { color: text, fontSize: 9 },
            itemWidth: 14,
            itemHeight: 7,
            data: plot.components.map((c) => c.displayName),
        },
        xAxis: {
            type: "category",
            axisLabel: { color: text, fontSize: 8, rotate: 30, interval: "auto" },
            splitLine: { lineStyle: { color: gridLine } },
            axisTick: { show: false },
        },
        yAxis: {
            type: "value",
            name: yAxisLabel(plot),
            scale: true,
            nameTextStyle: { color: text, fontSize: 9 },
            axisLabel: { color: text, fontSize: 8 },
            splitLine: { lineStyle: { color: gridLine } },
        },
        series: plot.components.map((c, i) => ({
            name: c.displayName,
            type: "line",
            smooth: true,
            showSymbol: false,
            step: plot.measurementType === MEASUREMENT_TYPE.TAP ? "end" : false,
            lineStyle: { color: PALETTE[i % PALETTE.length], width: 1.5 },
            itemStyle: { color: PALETTE[i % PALETTE.length] },
        })),
    };

    return (
        <div className="custom-plot">
            <div className="custom-plot__header" style={{ color: text }}>
                <span className="custom-plot__title">{plot.name}</span>
                <button
                    className="custom-plot__remove"
                    style={{ color: text }}
                    title="Remove plot"
                    onClick={() => onRemove(plot.id)}
                >
                    ✕
                </button>
            </div>
            <ReactECharts
                ref={chartRef}
                option={option}
                style={{ height: "220px" }}
                notMerge={false}
                lazyUpdate
            />
        </div>
    );
};

export default CustomPlot;
