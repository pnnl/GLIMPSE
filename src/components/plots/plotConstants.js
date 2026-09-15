import { TIMELINE_GRID_BOTTOM, timelineDataZoom } from "../../hooks/useChartTimeline";

// Measurement types as emitted by the backend (see server.py on_sim_output).
export const MEASUREMENT_TYPE = {
    VOLTAGE: "PNV",
    POWER: "VA",
    TAP: "Pos",
};

export const chartColors = (darkMode) => ({
    text: darkMode ? "#cccccc" : "#333333",
    bg: darkMode ? "#1f1f1f" : "#fafafa",
    gridLine: darkMode ? "#2e2e2e" : "#ebebeb",
    accent: darkMode ? "#8ab4f8" : "#5470c6",
});

/** ECharts option shared by every timeline chart; callers add `series`. */
export const baseChartOption = (darkMode, { legend, yAxis }) => {
    const { text, bg, gridLine, accent } = chartColors(darkMode);

    return {
        backgroundColor: bg,
        textStyle: { color: text },
        // Extra bottom room for the zoom slider.
        grid: { left: 52, right: 10, top: 38, bottom: TIMELINE_GRID_BOTTOM },
        tooltip: { trigger: "axis", confine: true, textStyle: { fontSize: 10 } },
        legend: {
            top: 4,
            textStyle: { color: text, fontSize: 9 },
            itemWidth: 14,
            itemHeight: 7,
            data: legend,
        },
        xAxis: {
            type: "category",
            axisLabel: { color: text, fontSize: 8, rotate: 30, interval: "auto" },
            splitLine: { lineStyle: { color: gridLine } },
            axisTick: { show: false },
        },
        yAxis: {
            type: "value",
            nameTextStyle: { color: text, fontSize: 9 },
            axisLabel: { color: text, fontSize: 8 },
            splitLine: { lineStyle: { color: gridLine } },
            ...yAxis,
        },
        dataZoom: timelineDataZoom(accent),
    };
};
