import { useState, useEffect, useMemo } from "react";
import { TreeSelect } from "antd";
import { useGraph } from "../contexts/GraphContext";
import graphHelper from "../graph-helper/GraphHelper";
import useAreaHighlight from "../hooks/useAreaHighlight";
import { FILL_ALPHA, BORDER_ALPHA } from "./graph/AreaHighlightLayers";

const buildTreeData = (areas) =>
    Object.entries(areas).map(([type, areaList]) => ({
        title: type,
        value: `__type__${type}`,
        selectable: false,
        children: areaList.map(({ name, id }) => ({ title: name, value: id })),
    }));

const DistributionAreaSelector = () => {
    // The tree can be resolved synchronously when the component mounts with a
    // graph already loaded; graph load/clear events update it afterwards.
    const [treeData, setTreeData] = useState(() => {
        const current = graphHelper.distributionAreas;
        return Object.keys(current).length > 0 ? buildTreeData(current) : [];
    });
    const { darkMode } = useGraph();

    // The selection, its colors and the WebGL contour layers all live outside
    // this component — the agent markers drive the same highlight, so there is
    // one shared controller and AreaHighlightLayers does the drawing.
    const areaHighlight = useAreaHighlight();
    const { selection, colors } = areaHighlight;

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
            // The selection outlives a remount, so a new model would otherwise
            // inherit area ids belonging to the previous one.
            areaHighlight.clear();
            setTreeData(buildTreeData(graphHelper.distributionAreas));
        };

        const handleGraphCleared = () => {
            setTreeData([]);
            areaHighlight.clear();
        };

        window.addEventListener("graph-loaded", handleGraphLoaded);
        window.addEventListener("graph-cleared", handleGraphCleared);

        return () => {
            window.removeEventListener("graph-loaded", handleGraphLoaded);
            window.removeEventListener("graph-cleared", handleGraphCleared);
        };
    }, [areaHighlight]);

    if (treeData.length === 0) return null;

    // Same palette the graph legend panels use, so both float over the canvas
    // as the same kind of surface in either theme.
    const c = darkMode
        ? { bg: "rgba(31,31,31,0.92)", text: "#e0e0e0", border: "#3a3a3a" }
        : { bg: "rgba(255,255,255,0.92)", text: "#1f1f1f", border: "#e0e0e0" };

    return (
        <>
            <TreeSelect
                style={{ width: 240 }}
                value={selection}
                styles={{ popup: { root: { maxHeight: 400, overflow: "auto" } } }}
                treeData={treeData}
                placeholder="Filter by Distribution Area"
                showSearch
                allowClear
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                maxTagCount="responsive"
                onChange={(values) => areaHighlight.select(values ?? [])}
            />

            {selection.length > 0 && (
                <div
                    style={{
                        marginTop: 8,
                        width: 240,
                        padding: "8px 10px",
                        background: c.bg,
                        color: c.text,
                        border: `1px solid ${c.border}`,
                        borderRadius: 6,
                        fontSize: 12,
                        boxShadow: darkMode ? "0 1px 4px rgba(0,0,0,0.5)" : "0 1px 4px rgba(0,0,0,0.15)",
                    }}
                >
                    {selection.map((id) => (
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
                                    // mirror the layer: light fill, solid outline
                                    background: `${colors[id]}${FILL_ALPHA}`,
                                    border: `1px solid ${colors[id]}${BORDER_ALPHA}`,
                                }}
                            />
                            <span
                                style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {nameById[id] ?? id}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default DistributionAreaSelector;
