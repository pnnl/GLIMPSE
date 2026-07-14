import { useCallback, useEffect, useRef, useState } from "react";
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
import "../../styles/GraphControls.css";

// Tile sources for the map background: OSM standard in light mode, CARTO's
// dark-matter tiles in dark mode. Both hosts must stay allowed in the CSP
// img-src of index.html.
const MAP_TILES = {
    light: {
        urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    dark: {
        urlTemplate: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
};

const GraphControls = () => {
    const { darkMode } = useGraph();
    const sigma = useSigma();
    const { zoomIn, zoomOut, reset } = useCamera();
    const { toggle: toggleFullScreen, isFullScreen } = useFullScreen();

    // Map background (only for graphs whose x/y are real lon/lat). Binding the
    // leaflet layer reprojects every node's x/y to the map's coordinate space,
    // so the pre-map positions are saved and restored on unbind — otherwise a
    // later remount (or an export) would see the projected coordinates.
    const [mapShown, setMapShown] = useState(false);
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

    const bindMap = useCallback(() => {
        mapLayerRef.current = bindLeafletLayer(sigma, {
            tileLayer: MAP_TILES[darkMode ? "dark" : "light"],
        });

        // bindLeafletLayer projects node x/y into the map's coordinate space,
        // but sigma keeps normalizing the render through the custom bbox that
        // GraphEvents pinned from the *original* coordinates, so the layer's
        // first sync flings map and camera to a nonsense location. Drop the
        // stale bbox and re-render — normalization then follows the projected
        // coordinates (GraphEvents re-pins the bbox from them) — and reframe;
        // the layer's afterRender hook flies the map to the matching view.
        sigma.setCustomBBox(null);
        sigma.refresh();
        sigma.getCamera().setState({ x: 0.5, y: 0.5, ratio: 1, angle: 0 });
    }, [sigma, darkMode]);

    // `restoreView: false` is the unmount path: React tears down parents first,
    // so the sigma instance is already killed — touching its bbox/camera there
    // schedules a render on the dead instance and crashes. Restoring the node
    // positions is still needed (the graph object survives into the next mount).
    const unbindMap = useCallback((restoreView = true) => {
        if (mapLayerRef.current) {
            mapLayerRef.current.clean();
            mapLayerRef.current = null;
        }

        // Restore positions by node id into whatever graph is CURRENT, via the
        // graphHelper singleton. Instances captured at bind time can be
        // orphaned before the map is turned off: toggling dark mode hands
        // react-sigma a new settings object, which rebuilds the whole Sigma
        // instance (and its graph) while the map stays bound. On a new-file
        // load the node ids won't match and this is a harmless no-op.
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

    // Swap tile source in place when dark mode changes while the map is shown.
    useEffect(() => {
        if (!mapLayerRef.current) return;
        mapLayerRef.current.clean();
        bindMap();
    }, [bindMap]);

    const toggleMap = () => {
        if (mapShown) {
            unbindMap();
            sigma.getCamera().animatedReset();
            setMapShown(false);
            return;
        }

        if (isRunning) stop(); // the force layout would fight the geographic positions

        const positions = new Map();
        sigma.getGraph().forEachNode((node, attrs) =>
            positions.set(node, { x: attrs.x, y: attrs.y }),
        );
        savedPositionsRef.current = positions;

        bindMap();
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
            <Tooltip
                title={
                    !graphHelper.hasGeoCoords
                        ? "Map requires a graph with latitude/longitude coordinates"
                        : mapShown
                          ? "Hide Map"
                          : "Show Map"
                }
                placement="right"
            >
                <Button
                    type={mapShown ? "primary" : "default"}
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
                          ? "Stop Layout"
                          : "Start Layout"
                }
                placement="right"
            >
                <Button
                    type={isRunning ? "primary" : "default"}
                    disabled={mapShown}
                    icon={isRunning ? <IoStop /> : <IoPlay />}
                    onClick={toggleLayout}
                />
            </Tooltip>
        </Space.Compact>
    );
};

export default GraphControls;
