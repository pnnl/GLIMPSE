import { useState, useEffect, useRef, useMemo } from "react";
import { TreeSelect, message } from "antd";
import { useSigma } from "@react-sigma/core";
import { bindWebGLLayer, createContoursProgram } from "@sigma/layer-webgl";
import iwanthue from "iwanthue";
import graphHelper from "../graph-helper/GraphHelper";

// Each highlighted area is a separate full-canvas WebGL contour layer, so GPU
// memory/draw cost scales linearly with the selection. Cap how many can render
// at once to avoid exhausting the WebGL context (which crashes the canvas) on
// large models with hundreds of distribution areas.
const MAX_HIGHLIGHT_AREAS = 10;

const buildTreeData = (areas) =>
    Object.entries(areas).map(([type, areaList]) => ({
        title: type,
        value: `__type__${type}`,
        selectable: false,
        children: areaList.map(({ name, id }) => ({ title: name, value: id })),
    }));

// Nesting-aware area membership. A node/edge carries its full ancestry
// (feeder_area_id / switch_area_id / secondary_area_id), so matching any level
// means selecting a switch area also covers its secondary areas, and selecting a
// feeder area covers everything under it.
const nodeInArea = (attrs, areaId) => {
    const a = attrs.attributes || {};
    return a.feeder_area_id === areaId || a.switch_area_id === areaId || a.secondary_area_id === areaId;
};

// Only connectivity nodes feed the contour hull / camera fit: they're the fixed,
// coordinate-bearing nodes. Equipment nodes (loads, caps, DGs, batteries) float on
// the layout, so they shouldn't define the contour — but they're still highlighted
// via the reducer grey-out since they carry the same area ids.
const contourNodeInArea = (attrs, areaId) =>
    attrs.group === "connectivity_node" && nodeInArea(attrs, areaId);

const DistributionAreaSelector = () => {
    // The tree can be resolved synchronously when the component mounts with a
    // graph already loaded; graph load/clear events update it afterwards.
    const [treeData, setTreeData] = useState(() => {
        const current = graphHelper.distributionAreas;
        return Object.keys(current).length > 0 ? buildTreeData(current) : [];
    });
    const [selectedAreas, setSelectedAreas] = useState([]);
    const [legend, setLegend] = useState([]); // [{ id, name, color }] mirrors colorMapRef for rendering
    const colorMapRef = useRef({}); // areaId -> color; stable across renders
    const sigma = useSigma();

    // areaId -> display name, rebuilt whenever the tree changes
    const nameById = useMemo(() => {
        const map = {};
        treeData.forEach(({ children }) =>
            children?.forEach(({ title, value }) => {
                map[value] = title;
            }),
        );
        return map;
    }, [treeData]);

    // Listen for graph load/clear events
    useEffect(() => {
        const handleGraphLoaded = () => {
            setTreeData(buildTreeData(graphHelper.distributionAreas));
        };

        const handleGraphCleared = () => {
            setTreeData([]);
            setSelectedAreas([]);
            setLegend([]);
            colorMapRef.current = {};
        };

        window.addEventListener("graph-loaded", handleGraphLoaded);
        window.addEventListener("graph-cleared", handleGraphCleared);

        return () => {
            window.removeEventListener("graph-loaded", handleGraphLoaded);
            window.removeEventListener("graph-cleared", handleGraphCleared);
        };
    }, []);

    // Create / destroy WebGL contour layers whenever the selection or sigma instance changes
    useEffect(() => {
        if (!sigma || selectedAreas.length === 0) {
            return;
        }

        // Hard cap the rendered set so we never exceed the WebGL layer budget,
        // even if the selection was set programmatically. Colors were assigned
        // by the selection handler before the selection state landed here.
        const areasToRender = selectedAreas
            .slice(0, MAX_HIGHLIGHT_AREAS)
            .filter((id) => colorMapRef.current[id]);

        // Raise the listener cap so sigma doesn't warn on many simultaneous layers
        sigma.setMaxListeners(areasToRender.length + 10);

        // Build one WebGL contour layer per selected area
        const cleanups = areasToRender.flatMap((areaId) => {
            const nodes = graphHelper.graph.filterNodes((_n, attrs) => contourNodeInArea(attrs, areaId));

            if (nodes.length === 0) return [];

            try {
                const cleanup = bindWebGLLayer(
                    `dist-area-${areaId}`,
                    sigma,
                    createContoursProgram(nodes, {
                        radius: sigma.getGraph().order < 500 ? 60 : 25,
                        zoomToRadiusRatioFunction: (x) => x,
                        levels: [{ color: `${colorMapRef.current[areaId]}AA`, threshold: 0.4 }],
                        border: { color: `#00000000`, thickness: 0 },
                    }),
                );
                return [cleanup];
            } catch (err) {
                console.error(`[WebGL] Failed to create layer for area ${areaId}:`, err);
                return [];
            }
        });

        // Camera: animate to the bounding box of all highlighted nodes
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        areasToRender.forEach((areaId) => {
            graphHelper.graph
                .filterNodes((_n, attrs) => contourNodeInArea(attrs, areaId))
                .forEach((nodeId) => {
                    const d = sigma.getNodeDisplayData(nodeId);
                    if (d) {
                        if (d.x < minX) minX = d.x;
                        if (d.x > maxX) maxX = d.x;
                        if (d.y < minY) minY = d.y;
                        if (d.y > maxY) maxY = d.y;
                    }
                });
        });

        if (minX < Infinity) {
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const spread = Math.max(maxX - minX, maxY - minY);
            const ratio = Math.min(5, Math.max(0.05, spread * 1.15));
            sigma.getCamera().animate({ x: centerX, y: centerY, ratio }, { duration: 800 });
        }

        return () => cleanups.forEach((fn) => fn());
    }, [selectedAreas, sigma]);

    // Drive the reducer grey-out: push the (capped) selection into graphHelper and
    // refresh so non-member nodes/edges dim. An empty selection clears it (shows all).
    useEffect(() => {
        graphHelper.setHighlightedAreas(selectedAreas.slice(0, MAX_HIGHLIGHT_AREAS));
        if (sigma) sigma.refresh();
    }, [selectedAreas, sigma]);

    // Cap the selection so we never spin up more WebGL layers than the GPU can
    // handle; warn the user when their selection is truncated.
    const handleChange = (values) => {
        const next = values ?? [];
        if (next.length > MAX_HIGHLIGHT_AREAS) {
            message.warning(
                `Only ${MAX_HIGHLIGHT_AREAS} distribution areas can be highlighted at once. ` +
                    `Showing the first ${MAX_HIGHLIGHT_AREAS} of ${next.length}.`,
            );
        }
        const capped = next.slice(0, MAX_HIGHLIGHT_AREAS);

        // Assign a stable color to each newly selected area and drop colors of
        // deselected ones. Done here (event time) so the layer effect and the
        // legend always find their colors ready.
        const newAreaIds = capped.filter((id) => !colorMapRef.current[id]);
        if (newAreaIds.length > 0) {
            const colors = iwanthue(newAreaIds.length, {
                colorSpace: [0, 360, 35, 100, 25, 65],
            });
            newAreaIds.forEach((id, i) => {
                colorMapRef.current[id] = colors[i];
            });
        }
        Object.keys(colorMapRef.current).forEach((id) => {
            if (!capped.includes(id)) delete colorMapRef.current[id];
        });

        setLegend(
            capped.map((id) => ({ id, name: nameById[id] ?? id, color: colorMapRef.current[id] })),
        );
        setSelectedAreas(capped);
    };

    if (treeData.length === 0) return null;

    return (
        <>
            <TreeSelect
                style={{ width: 240 }}
                value={selectedAreas}
                styles={{ popup: { root: { maxHeight: 400, overflow: "auto" } } }}
                treeData={treeData}
                placeholder="Filter by Distribution Area"
                showSearch
                allowClear
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                treeNodeFilterProp="title"
                maxTagCount="responsive"
                onChange={handleChange}
            />

            {legend.length > 0 && (
                <div
                    style={{
                        marginTop: 8,
                        width: 240,
                        padding: "8px 10px",
                        background: "rgba(255,255,255,0.9)",
                        borderRadius: 6,
                        fontSize: 12,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                    }}
                >
                    {legend.map(({ id, name, color }) => (
                        <div
                            key={id}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}
                        >
                            <span
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 3,
                                    flexShrink: 0,
                                    background: `${color}AA`, // match the contour fill's alpha
                                }}
                            />
                            <span
                                style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {name}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default DistributionAreaSelector;
