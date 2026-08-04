import { useCallback, useEffect, useRef, useState } from "react";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";

// ============================================================================
// useChartTimeline — scrollable history for the live simulation charts.
// ============================================================================
// Before this, every chart kept a 20-point rolling buffer and shift()ed older
// samples away, so the run's history was destroyed as it streamed. Now the full
// run is retained and the charts show a moving window over it:
//
//   • while a run streams, the window stays pinned to the newest samples
//   • panning or zooming detaches from that live edge, so scrolling back
//     mid-run isn't yanked forward by the next frame
//   • scrolling back to the right-hand edge re-attaches
//   • when the run ends the whole run is revealed, ready to be scrolled
//   • starting a new run clears the history
//
// Shared by SimulationCharts (the built-in voltage/load charts) and CustomPlot
// so both behave identically.

// Samples retained per series. At a 3 s publish period this is ~3 hours; the
// arrays are plain numbers, so even the widest chart costs a few hundred kB.
export const MAX_HISTORY_POINTS = 3600;

// How many samples the live window shows. Matches the old fixed buffer size, so
// a running simulation looks the same as before — the history is simply kept
// off-screen to the left instead of being thrown away.
export const LIVE_WINDOW_POINTS = 20;

/** Drop the oldest sample once a series exceeds the retention cap. */
export const trimHistory = (arr) => {
    if (arr.length > MAX_HISTORY_POINTS) arr.shift();
};

// Zoom/pan controls added to every timeline chart: wheel + drag on the plot
// itself, plus a slider so it's discoverable. `start`/`end` are deliberately
// omitted — ReactECharts re-applies the declarative option on each render, and
// naming them here would snap the user's scroll position back on every
// re-render (a dark-mode toggle, a resize).
export const timelineDataZoom = (accentColor) => [
    { type: "inside", filterMode: "none", zoomOnMouseWheel: true, moveOnMouseMove: true },
    {
        type: "slider",
        filterMode: "none",
        height: 16,
        bottom: 2,
        borderColor: "transparent",
        backgroundColor: "transparent",
        fillerColor: `${accentColor}22`,
        handleStyle: { color: accentColor },
        moveHandleSize: 4,
        showDetail: false,
        showDataShadow: false,
    },
];

// The slider needs room below the axis labels.
export const TIMELINE_GRID_BOTTOM = 62;

/**
 * @param {Object} chartRef - ref to a ReactECharts element
 * @param {Function} getPointCount - current number of samples on the x axis
 * @param {Function} clearBuffers - reset the caller's own data arrays
 * @returns {{ syncWindow: Function, isFollowing: boolean, resumeFollowing: Function }}
 *   Call `syncWindow()` right after appending samples.
 */
export const useChartTimeline = (chartRef, getPointCount, clearBuffers) => {
    // Whether the view is pinned to the newest samples. A ref drives the logic
    // (it's read from event handlers), the state only drives the "Live" button.
    const followingRef = useRef(true);
    const [isFollowing, setIsFollowing] = useState(true);

    // Set while we drive the zoom ourselves, so our own dispatchAction isn't
    // mistaken for the user panning away from the live edge.
    const selfDrivenRef = useRef(false);
    const listenerAttachedRef = useRef(false);

    const getChart = useCallback(
        () => chartRef.current?.getEchartsInstance?.() ?? null,
        [chartRef],
    );

    const setFollowing = useCallback((value) => {
        followingRef.current = value;
        setIsFollowing(value);
    }, []);

    const dispatchZoom = useCallback(
        (payload) => {
            const chart = getChart();
            if (!chart) return;
            selfDrivenRef.current = true;
            // dispatchAction and its resulting event are synchronous, so the
            // flag can be cleared immediately afterwards.
            chart.dispatchAction({ type: "dataZoom", ...payload });
            selfDrivenRef.current = false;
        },
        [getChart],
    );

    const showAll = useCallback(() => dispatchZoom({ start: 0, end: 100 }), [dispatchZoom]);

    // Detaching happens on any user pan/zoom; returning to the right-hand edge
    // re-attaches, so there's a way back to live without a button.
    const attachListener = useCallback(() => {
        if (listenerAttachedRef.current) return;
        const chart = getChart();
        if (!chart) return;

        chart.on("dataZoom", () => {
            if (selfDrivenRef.current) return;
            const zoom = chart.getOption()?.dataZoom?.[0];
            setFollowing(zoom ? zoom.end >= 99.5 : true);
        });

        listenerAttachedRef.current = true;
    }, [getChart, setFollowing]);

    /** Pin the view back to the newest samples. */
    const resumeFollowing = useCallback(() => {
        setFollowing(true);
        const total = getPointCount();
        if (total > LIVE_WINDOW_POINTS) {
            dispatchZoom({ startValue: total - LIVE_WINDOW_POINTS, endValue: total - 1 });
        } else {
            showAll();
        }
    }, [getPointCount, dispatchZoom, showAll, setFollowing]);

    /** Call after appending samples — advances the window if still following. */
    const syncWindow = useCallback(() => {
        // echarts-for-react initialises asynchronously, so the instance may not
        // have existed when the mount effect ran.
        attachListener();

        if (!followingRef.current) return;

        const total = getPointCount();
        if (total <= LIVE_WINDOW_POINTS) {
            showAll();
            return;
        }
        dispatchZoom({ startValue: total - LIVE_WINDOW_POINTS, endValue: total - 1 });
    }, [attachListener, getPointCount, dispatchZoom, showAll]);

    useEffect(() => {
        attachListener();
    }, [attachListener]);

    useEffect(() => {
        const unsubRunStart = socketClientHelper.on("sim-run-start", () => {
            clearBuffers();
            setFollowing(true);
            showAll();
        });

        const unsubState = socketClientHelper.on("sim-state-change", (state) => {
            // The run is over: reveal all of it so the user can scroll back
            // through what happened, and stop chasing an edge that won't move.
            if (state === "stopped" || state === "error") {
                setFollowing(false);
                showAll();
            }
        });

        return () => {
            unsubRunStart();
            unsubState();
        };
    }, [clearBuffers, showAll, setFollowing]);

    return { syncWindow, isFollowing, resumeFollowing };
};

export default useChartTimeline;
