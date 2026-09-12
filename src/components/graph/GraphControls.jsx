import { useCallback, useEffect, useRef } from "react";
import { Button, Tooltip, Space } from "antd";
import { useCamera, useFullScreen, useSigma } from "@react-sigma/core";
import { useWorkerLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import bindLeafletLayer from "@sigma/layer-leaflet";
import "leaflet/dist/leaflet.css";
import { BiZoomIn, BiZoomOut } from "react-icons/bi";
import { MdFilterCenterFocus, MdFullscreen, MdFullscreenExit, MdOutlineMap } from "react-icons/md";
import { IoPlay, IoStop } from "react-icons/io5";
import graphHelper from "../../graph-helper/GraphHelper";
import { useGraph } from "../../contexts/GraphContext";
import { useShortcut } from "../../hooks/useShortcut";
import "../../styles/GraphControls.css";

const MAP_TILE_LAYER = {
    urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

const GraphControls = () => {
    const { darkMode, mapShown, setMapShown } = useGraph();
    const sigma = useSigma();
    const { zoomIn, zoomOut } = useCamera();
    const { toggle: toggleFullScreen, isFullScreen } = useFullScreen();

    const mapLayerRef = useRef(null); // { clean, map, ... } returned by bindLeafletLayer
    const savedPositionsRef = useRef(null); // Map<nodeId, {x, y}> captured before binding

    const { start, stop, kill, isRunning } = useWorkerLayoutForceAtlas2({
        settings: {
            barnesHutOptimize: sigma.getGraph().order > 2_500,
            barnesHutTheta: 0.5,
            linLogMode: false,
            adjustSizes: false,
            edgeWeightInfluence: 1,
            outboundAttractionDistribution: false,
            scalingRatio: 1,
            gravity: 1,
            strongGravityMode: false,
            slowDown: 5,
        },
    });

    // Make sure the worker is torn down when the controls unmount.
    useEffect(() => () => kill(), [kill]);

    // Takes the instance explicitly rather than closing over `sigma`, so a
    // caller always binds to the instance it has actually checked.
    const bindMap = useCallback((instance) => {
        mapLayerRef.current = bindLeafletLayer(instance, {
            tileLayer: MAP_TILE_LAYER,
        });

        instance.setCustomBBox(null);
        instance.refresh();
        instance.getCamera().setState({ x: 0.5, y: 0.5, ratio: 1, angle: 0 });
    }, []);

    const unbindMap = useCallback((restoreView = true) => {
        if (mapLayerRef.current) {
            mapLayerRef.current.clean();
            mapLayerRef.current = null;
        }

        const positions = savedPositionsRef.current;
        if (positions) {
            graphHelper.graph.updateEachNodeAttributes((node, attrs) => {
                const pos = positions.get(node);
                return pos ? { ...attrs, x: pos.x, y: pos.y } : attrs;
            });
            savedPositionsRef.current = null;

            // Drop the bbox pinned from the projected coordinates and
            // re-render; GraphEvents re-pins it from the restored ones.
            if (restoreView && graphHelper.sigmaInstance) {
                graphHelper.sigmaInstance.setCustomBBox(null);
                graphHelper.sigmaInstance.refresh();
            }
        }
    }, []);

    // Unbind on unmount so a SigmaContainer remount starts from clean positions.
    useEffect(() => () => unbindMap(false), [unbindMap]);

    // Kept in a ref so the re-bind effect below can depend on the sigma
    // instance alone, without also firing when the map is simply toggled.
    const mapShownRef = useRef(false);
    useEffect(() => {
        mapShownRef.current = mapShown;
    }, [mapShown]);

    useEffect(() => {
        if (!mapShownRef.current || !sigma) return;
        if (mapLayerRef.current) mapLayerRef.current.clean();
        bindMap(sigma);
    }, [sigma, bindMap]);

    const toggleMap = () => {
        if (mapShown) {
            unbindMap();
            sigma.getCamera().animatedReset();
            setMapShown(false);
            return;
        }

        if (isRunning) stop(); // the force layout would fight the geographic positions

        const positions = new Map();
        sigma.getGraph().forEachNode((node, attrs) => positions.set(node, { x: attrs.x, y: attrs.y }));
        savedPositionsRef.current = positions;

        bindMap(sigma);
        setMapShown(true);
    };

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
        // 1.05 → tight fit: the graph sits just barely inside the viewport with a
        // sliver of margin so edge nodes aren't clipped. Raise for more padding.
        const ratio = Math.min(5, Math.max(0.05, spread * 0.95));

        sigma.getCamera().animate({ x: centerX, y: centerY, ratio }, { duration: 500 });
    };

    useShortcut("f", center);
    useShortcut("l", toggleLayout, { enabled: !mapShown });
    useShortcut("m", toggleMap, { enabled: graphHelper.hasGeoCoords });

    return (
        <Space.Compact
            orientation="vertical"
            className="graph-controls"
            style={{ backgroundColor: darkMode ? "#1f1f1f" : "#ffffff" }}
        >
            <Tooltip title="Zoom In" placement="right">
                <Button aria-label="Zoom in" icon={<BiZoomIn />} onClick={() => zoomIn()} />
            </Tooltip>
            <Tooltip title="Zoom Out" placement="right">
                <Button aria-label="Zoom out" icon={<BiZoomOut />} onClick={() => zoomOut()} />
            </Tooltip>
            <Tooltip title="Center & Fit (F)" placement="right">
                <Button
                    aria-label="Center and fit the graph"
                    icon={<MdFilterCenterFocus />}
                    onClick={center}
                />
            </Tooltip>
            <Tooltip title={isFullScreen ? "Exit Full Screen" : "Full Screen"} placement="right">
                <Button
                    aria-label={isFullScreen ? "Exit full screen" : "Enter full screen"}
                    aria-pressed={isFullScreen}
                    icon={isFullScreen ? <MdFullscreenExit /> : <MdFullscreen />}
                    onClick={toggleFullScreen}
                />
            </Tooltip>
            <Tooltip
                title={
                    !graphHelper.hasGeoCoords
                        ? "Map requires a graph with latitude/longitude coordinates"
                        : mapShown
                          ? "Hide Map (M)"
                          : "Show Map (M)"
                }
                placement="right"
            >
                <Button
                    type={mapShown ? "primary" : "default"}
                    aria-label={mapShown ? "Hide map background" : "Show map background"}
                    aria-pressed={mapShown}
                    disabled={!graphHelper.hasGeoCoords}
                    icon={<MdOutlineMap />}
                    onClick={toggleMap}
                />
            </Tooltip>
            <Tooltip
                title={
                    mapShown
                        ? "Layout is disabled while the map is shown"
                        : isRunning
                          ? "Stop Layout (L)"
                          : "Start Layout (L)"
                }
                placement="right"
            >
                <Button
                    type={isRunning ? "primary" : "default"}
                    aria-label={isRunning ? "Stop the force layout" : "Start the force layout"}
                    aria-pressed={isRunning}
                    disabled={mapShown}
                    icon={isRunning ? <IoStop /> : <IoPlay />}
                    onClick={toggleLayout}
                />
            </Tooltip>
        </Space.Compact>
    );
};

export default GraphControls;
