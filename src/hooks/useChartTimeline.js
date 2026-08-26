import { useCallback, useEffect, useRef, useState } from "react";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";

export const MAX_HISTORY_POINTS = 3600;
export const LIVE_WINDOW_POINTS = 20;

/** Drop the oldest sample once a series exceeds the retention cap. */
export const trimHistory = (arr) => {
    if (arr.length > MAX_HISTORY_POINTS) arr.shift();
};

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
    const followingRef = useRef(true);
    const [isFollowing, setIsFollowing] = useState(true);
    const selfDrivenRef = useRef(false);
    const listenerAttachedRef = useRef(false);

    const getChart = useCallback(() => chartRef.current?.getEchartsInstance?.() ?? null, [chartRef]);

    const setFollowing = useCallback((value) => {
        followingRef.current = value;
        setIsFollowing(value);
    }, []);

    const dispatchZoom = useCallback(
        (payload) => {
            const chart = getChart();
            if (!chart) return;
            selfDrivenRef.current = true;
            chart.dispatchAction({ type: "dataZoom", ...payload });
            selfDrivenRef.current = false;
        },
        [getChart],
    );

    const showAll = useCallback(() => dispatchZoom({ start: 0, end: 100 }), [dispatchZoom]);

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
