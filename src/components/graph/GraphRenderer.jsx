import "@react-sigma/core/lib/style.css";
import { useEffect, useMemo, useCallback } from "react";
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
import DistributionAreaSelector from "../DistributionAreaSelector";
import GraphControls from "./GraphControls";
import LegendPanel from "../legend/LegendPanel";

const INACTIVE_COLOR = "rgba(145, 145, 145, 0.7)";

// Grey out a node (used when it falls outside the highlighted groups/areas).
const dimNodeAttrs = (attrs) => ({
    ...attrs,
    color: INACTIVE_COLOR,
    borderColor: INACTIVE_COLOR,
    type: "node",
    label: "",
    image: "",
});

// Grey out an edge, keeping its icon program but dimming the icon too. Keyed off
// iconType (not type) so curved parallel variants dim as well.
const dimEdgeAttrs = (attrs) => {
    const base = { ...attrs, color: INACTIVE_COLOR, label: "", size: 1 };
    if (attrs.iconType === "switch") return { ...base, switchColor: INACTIVE_COLOR, switchSize: 2 };
    if (attrs.iconType === "regulator") return { ...base, regulatorColor: INACTIVE_COLOR };
    if (attrs.iconType === "transformer") return { ...base, transformerColor: INACTIVE_COLOR };
    return base;
};

const GraphRenderer = () => {
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

    const customNodeReducer = useCallback((_n, attrs) => {
        if (graphHelper.graph.order === 0) return attrs;

        // Distribution-area highlighting takes precedence: grey out any node that
        // is not in a selected area. Members keep their styling (the colored
        // contour hull marks them); nesting is handled in isInHighlightedArea.
        if (graphHelper.getHighlightedAreas().length > 0) {
            return graphHelper.isInHighlightedArea(attrs) ? attrs : dimNodeAttrs(attrs);
        }

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
            return dimNodeAttrs(attrs);
        }
        return { ...attrs, size: attrs.size * 2 };
    }, []);

    const customEdgeReducer = useCallback(
        (edgeId, attrs) => {
            // Searched/focused edge always wins: pulse it and keep it on top —
            // never dim it, whatever the area/group highlight state is.
            const focusStyle = graphHelper.getFocusedEdgeStyle(edgeId, attrs);
            if (focusStyle) return focusStyle;

            // Distribution-area highlighting takes precedence: grey out any edge that
            // is not in a selected area.
            if (graphHelper.getHighlightedAreas().length > 0) {
                return graphHelper.isInHighlightedArea(attrs) ? attrs : dimEdgeAttrs(attrs);
            }

            if (
                graphHelper.getHighlightedEdgeTypes().length === 0 &&
                graphHelper.getHighlightedGroups().length === 0
            ) {
                if (darkMode && attrs.group === "overhead_line") attrs.color = "#bfc0c0";
                return attrs;
            }

            if (!graphHelper.isHighlighted(attrs.group)) {
                return dimEdgeAttrs(attrs);
            }

            return { ...attrs, size: attrs.size * 1.5 };
        },
        [darkMode],
    );

    const sizeRatioFunc = (ratio) => {
        const exponent = graphHelper.graph.order > 1000 ? 0.2 : 0.6;
        return Math.pow(ratio, exponent);
    };

    // Memoized so its identity is stable across re-renders. Passing a fresh
    // settings object makes react-sigma tear down and rebuild the Sigma instance
    // (which reloads the graph and resets the camera). Keyed on darkMode + the
    // program classes; the reducers are useCallback-stable, so unrelated parent
    // re-renders (charts panel, sim state, etc.) no longer reload the graph.
    const settings = useMemo(
        () => ({
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
            zoomToSizeRatioFunction: sizeRatioFunc,
            inertiaRatio: 3,
            cameraPanBoundaries: null,
            zoomDuration: 250,
            zoomingRatio: 1.5,
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
        }),
        [customNodeReducer, customEdgeReducer],
    );

    return (
        <SigmaContainer
            key={graphUpdateTrigger}
            className={darkMode ? "sigma-dark" : ""}
            style={{ backgroundColor: darkMode ? "#1D1D1D" : "#ffffff" }}
            graph={MultiUndirectedGraph}
            settings={settings}
        >
            <Graph />
            <GraphEvents />
            <AnimatedEdgeTicker />
            <ControlsContainer style={{ border: "none", background: "none" }} position={"top-left"}>
                <DistributionAreaSelector />
            </ControlsContainer>
            <ControlsContainer style={{ border: "none", background: "none" }} position={"top-right"}>
                <LegendPanel />
            </ControlsContainer>
            <ControlsContainer style={{ border: "none", background: "none" }} position={"bottom-left"}>
                <GraphControls />
            </ControlsContainer>
        </SigmaContainer>
    );
};

export default GraphRenderer;
