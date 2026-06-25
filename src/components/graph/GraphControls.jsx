import { useEffect } from "react";
import { Button, Tooltip, Space } from "antd";
import { useCamera, useFullScreen, useSigma } from "@react-sigma/core";
import { useWorkerLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import { BiZoomIn, BiZoomOut } from "react-icons/bi";
import { MdFilterCenterFocus, MdFullscreen, MdFullscreenExit } from "react-icons/md";
import { IoPlay, IoStop } from "react-icons/io5";
import { useGraph } from "../../contexts/GraphContext";
import "../../styles/GraphControls.css";

/**
 * Custom replacements for sigma's built-in ZoomControl, FullScreenControl and
 * LayoutForceAtlas2Control. Gives us direct control over zoom, centering,
 * fullscreen and a start/stop ForceAtlas2 layout backed by a web worker.
 *
 * `layoutSettings` is the resolved FA2 settings object (see getFA2Settings).
 */
const GraphControls = ({ layoutSettings }) => {
    const { darkMode } = useGraph();
    const sigma = useSigma();
    const { zoomIn, zoomOut, reset } = useCamera();
    const { toggle: toggleFullScreen, isFullScreen } = useFullScreen();

    // FA2 web-worker supervisor: runs the layout off the main thread.
    // `start`/`stop` control the worker; `isRunning` reflects its state.
    const { start, stop, kill, isRunning } = useWorkerLayoutForceAtlas2({
        settings: layoutSettings,
    });

    // Make sure the worker is torn down when the controls unmount.
    useEffect(() => () => kill(), [kill]);

    const toggleLayout = () => {
        if (isRunning) stop();
        else start();
    };

    // Fit the whole graph back into view: animate the camera to the bounding box
    // of every node's current display position (rather than resetting to default).
    const center = () => {
        const graph = sigma.getGraph();
        if (graph.order === 0) return;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        graph.forEachNode((node) => {
            const d = sigma.getNodeDisplayData(node);
            if (!d) return;
            if (d.x < minX) minX = d.x;
            if (d.x > maxX) maxX = d.x;
            if (d.y < minY) minY = d.y;
            if (d.y > maxY) maxY = d.y;
        });

        if (minX === Infinity) return; // no positioned nodes

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const spread = Math.max(maxX - minX, maxY - minY);
        const ratio = Math.min(5, Math.max(0.05, spread * 1.2));

        sigma.getCamera().animate({ x: centerX, y: centerY, ratio }, { duration: 500 });
    };

    return (
        <Space.Compact
            orientation="vertical"
            className="graph-controls"
            style={{ backgroundColor: darkMode ? "#1f1f1f" : "#ffffff" }}
        >
            <Tooltip title="Zoom In" placement="right">
                <Button icon={<BiZoomIn />} onClick={() => zoomIn()} />
            </Tooltip>
            <Tooltip title="Zoom Out" placement="right">
                <Button icon={<BiZoomOut />} onClick={() => zoomOut()} />
            </Tooltip>
            <Tooltip title="Center & Fit" placement="right">
                <Button icon={<MdFilterCenterFocus />} onClick={center} />
            </Tooltip>
            <Tooltip title={isFullScreen ? "Exit Full Screen" : "Full Screen"} placement="right">
                <Button
                    icon={isFullScreen ? <MdFullscreenExit /> : <MdFullscreen />}
                    onClick={toggleFullScreen}
                />
            </Tooltip>
            <Tooltip title={isRunning ? "Stop Layout" : "Start Layout"} placement="right">
                <Button
                    type={isRunning ? "primary" : "default"}
                    icon={isRunning ? <IoStop /> : <IoPlay />}
                    onClick={toggleLayout}
                />
            </Tooltip>
        </Space.Compact>
    );
};

export default GraphControls;
