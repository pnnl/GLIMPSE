import "@react-sigma/core/lib/style.css";
import { useEffect, useMemo, useState } from "react";
import { SigmaContainer, ControlsContainer, ZoomControl, FullScreenControl } from "@react-sigma/core";
import { LayoutForceAtlas2Control } from "@react-sigma/layout-forceatlas2";
import { MultiUndirectedGraph } from "graphology";
import { createNodeImageProgram, NodePictogramProgram, NodeImageProgram } from "@sigma/node-image";
import { createNodeBorderProgram, NodeBorderProgram } from "@sigma/node-border";
import { drawLabel, drawHover, setCanvasDarkMode } from "../../utils/canvas-utils";
import graphHelper from "../../graph-helper/GraphHelper";
import GraphEvents from "./GraphEvents";
import EdgeCurveProgram from "@sigma/edge-curve";
import { useGraph } from "../../contexts/GraphContext";
import Graph from "./Graph";
import {
    EdgeRectangleProgram,
    createNodeCompoundProgram,
    createEdgeCompoundProgram,
    EdgeArrowHeadProgram,
} from "sigma/rendering";
import AnimatedDotProgram from "../../custom-programs/animated-dot-program/AnimatedDotProgram";
import AnimatedEdgeTicker from "../AnimatedEdgeTicker";
import SwitchSquareProgram from "../../custom-programs/switch-program/SwitchSquareProgram";
import { getFA2Settings } from "../../utils/fa2-presets";
import DistributionAreaSelector from "../DistributionAreaSelector";

const GraphRenderer = () => {
    const [layoutSettings, setLayoutSettings] = useState({});
    const { graphUpdateTrigger, darkMode } = useGraph();

    useEffect(() => {
        setCanvasDarkMode(darkMode);
        if (graphHelper.sigmaInstance) graphHelper.sigmaInstance.refresh();
    }, [darkMode]);

    const BorderImageNodeProgram = useMemo(() => {
        const NodeBorderCustomProgram = createNodeBorderProgram({
            borders: [
                {
                    size: { attribute: "borderSize", defaultValue: 12 },
                    color: { attribute: "borderColor" },
                },
                { size: { fill: true }, color: { attribute: "color" } },
            ],
        });

        const NodePictogramCustomProgram = createNodeImageProgram();

        return createNodeCompoundProgram([NodeBorderCustomProgram, NodePictogramCustomProgram]);
    }, []);

    const AnimatedStraightEdgeProgram = useMemo(() => {
        return createEdgeCompoundProgram([EdgeRectangleProgram, AnimatedDotProgram]);
    }, []);

    const SwitchEdgeProgram = useMemo(() => {
        return createEdgeCompoundProgram([EdgeRectangleProgram, SwitchSquareProgram]);
    }, []);

    const customNodeReducer = (_n, attrs) => {
        if (graphHelper.graph.order === 0) return attrs;
        if (
            graphHelper.getHighlightedGroups().length === 0 &&
            graphHelper.getHighlightedEdgeTypes().length === 0
        )
            return attrs;

        if (
            !graphHelper.isHighlighted(attrs.group) ||
            (graphHelper.getHighlightedGroups().length === 0 &&
                graphHelper.getHighlightedEdgeTypes().length > 0)
        ) {
            return {
                ...attrs,
                color: "rgba(145, 145, 145, 0.7)",
                borderColor: "rgba(145, 145, 145, 0.7)",
                type: "node",
                label: "",
                image: "",
            };
        }
        return { ...attrs, size: attrs.size * 2 };
    };

    const customEdgeReducer = (_e, attrs) => {
        if (
            graphHelper.getHighlightedEdgeTypes().length === 0 &&
            graphHelper.getHighlightedGroups().length === 0
        ) {
            if (darkMode && attrs.group === "overhead_line") attrs.color = "#bfc0c0";
            return attrs;
        }

        if (!graphHelper.isHighlighted(attrs.group)) {
            const inactiveColor = "rgba(145, 145, 145, 0.7)";

            if (attrs.type === "switch") {
                return {
                    ...attrs,
                    color: inactiveColor,
                    label: "",
                    size: 1,
                    switchColor: inactiveColor,
                    switchSize: 2,
                };
            }

            return { ...attrs, color: inactiveColor, label: "", size: 1 };
        }

        return { ...attrs, size: attrs.size * 1.5 };
    };

    useEffect(() => {
        if (graphHelper.graph.order > 0) {
            setLayoutSettings(getFA2Settings(graphHelper.graph));
        }
    }, [graphUpdateTrigger]);

    return (
        <SigmaContainer
            key={graphUpdateTrigger}
            className={darkMode ? "sigma-dark" : ""}
            style={{ backgroundColor: darkMode ? "#1D1D1D" : "#ffffff" }}
            graph={MultiUndirectedGraph}
            settings={{
                allowInvalidContainer: true,
                minCameraRatio: 0.02,
                maxCameraRatio: null,
                renderEdgeLabels: true,
                itemSizesReference: "screen",
                autoRescale: true,
                autoCenter: true,
                doubleClickTimeout: 300,
                doubleClickZoomingRatio: 2.2,
                doubleClickZoomingDuration: 200,
                inertiaDuration: 200,
                inertiaRatio: 3,
                cameraPanBoundaries: null,
                zoomDuration: 250,
                zoomingRatio: 1.7,
                labelDensity: 0.7,
                labelSize: 13,
                labelGridCellSize: 80,
                labelRenderedSizeThreshold: 8,
                hideEdgesOnMove: false,
                hideLabelsOnMove: true,
                zIndex: true,
                enableEdgeEvents: true,
                defaultNodeType: "node",
                defaultDrawNodeLabel: drawLabel,
                defaultDrawNodeHover: drawHover,
                nodeProgramClasses: {
                    nodeImg: BorderImageNodeProgram,
                    node: NodeBorderProgram,
                },
                edgeProgramClasses: {
                    straight: EdgeRectangleProgram,
                    curved: EdgeCurveProgram,
                    animated: AnimatedStraightEdgeProgram,
                    switch: SwitchEdgeProgram,
                },
                nodeReducer: customNodeReducer,
                edgeReducer: customEdgeReducer,
            }}
        >
            <Graph />
            <GraphEvents />
            <AnimatedEdgeTicker />
            <ControlsContainer style={{ border: "none", background: "none" }} position={"top-left"}>
                <DistributionAreaSelector />
            </ControlsContainer>
            <ControlsContainer position={"bottom-left"}>
                <ZoomControl />
                <FullScreenControl />
                <LayoutForceAtlas2Control settings={{ settings: layoutSettings }} />
            </ControlsContainer>
        </SigmaContainer>
    );
};

export default GraphRenderer;
