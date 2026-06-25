import "@react-sigma/core/lib/style.css";
import { useEffect, useMemo, useState } from "react";
import { SigmaContainer, ControlsContainer } from "@react-sigma/core";
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
import RegulatorProgram from "../../custom-programs/regulator-program/RegulatorProgram";
import TransformerProgram from "../../custom-programs/transformer-program/TransformerProgram";
import { getFA2Settings } from "../../utils/fa2-presets";
import DistributionAreaSelector from "../DistributionAreaSelector";
import GraphControls from "./GraphControls";

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

    const RegulatorEdgeProgram = useMemo(() => {
        return createEdgeCompoundProgram([EdgeRectangleProgram, RegulatorProgram]);
    }, []);

    const TransformerEdgeProgram = useMemo(() => {
        return createEdgeCompoundProgram([EdgeRectangleProgram, TransformerProgram]);
    }, []);

    // Curved variants: a curved line + the same icon, used when parallel edges
    // between two nodes are fanned out so the icon stays on the visible curve.
    const CurvedSwitchEdgeProgram = useMemo(() => {
        return createEdgeCompoundProgram([EdgeCurveProgram, SwitchSquareProgram]);
    }, []);

    const CurvedRegulatorEdgeProgram = useMemo(() => {
        return createEdgeCompoundProgram([EdgeCurveProgram, RegulatorProgram]);
    }, []);

    const CurvedTransformerEdgeProgram = useMemo(() => {
        return createEdgeCompoundProgram([EdgeCurveProgram, TransformerProgram]);
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

            // Key off iconType (not type) so curved parallel variants dim too.
            if (attrs.iconType === "switch") {
                return {
                    ...attrs,
                    color: inactiveColor,
                    label: "",
                    size: 1,
                    switchColor: inactiveColor,
                    switchSize: 2,
                };
            }

            if (attrs.iconType === "regulator") {
                return {
                    ...attrs,
                    color: inactiveColor,
                    label: "",
                    size: 1,
                    regulatorColor: inactiveColor,
                };
            }

            if (attrs.iconType === "transformer") {
                return {
                    ...attrs,
                    color: inactiveColor,
                    label: "",
                    size: 1,
                    transformerColor: inactiveColor,
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
                itemSizesReference: "screen", // sizes in screen px; pairs with zoomToSizeRatioFunction
                autoRescale: true,
                autoCenter: true,
                doubleClickTimeout: 300,
                doubleClickZoomingRatio: 2.2,
                doubleClickZoomingDuration: 200,
                inertiaDuration: 200,
                zoomToSizeRatioFunction: (ratio) => Math.pow(ratio, 0.2),
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
                    regulator: RegulatorEdgeProgram,
                    transformer: TransformerEdgeProgram,
                    curvedSwitch: CurvedSwitchEdgeProgram,
                    curvedRegulator: CurvedRegulatorEdgeProgram,
                    curvedTransformer: CurvedTransformerEdgeProgram,
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
            <ControlsContainer style={{ border: "none", background: "none" }} position={"bottom-left"}>
                <GraphControls layoutSettings={layoutSettings} />
            </ControlsContainer>
        </SigmaContainer>
    );
};

export default GraphRenderer;
