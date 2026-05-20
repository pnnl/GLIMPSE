import "@react-sigma/core/lib/style.css";
import { useEffect, useMemo, useState } from "react";
import { SigmaContainer, ControlsContainer, ZoomControl, FullScreenControl } from "@react-sigma/core";
import { LayoutForceAtlas2Control } from "@react-sigma/layout-forceatlas2";
import { MultiUndirectedGraph } from "graphology";
import { createNodeImageProgram, NodePictogramProgram, NodeImageProgram } from "@sigma/node-image";
import { createNodeBorderProgram, NodeBorderProgram } from "@sigma/node-border";
import { drawLabel, drawHover } from "../../utils/canvas-utils";
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

const GraphRenderer = () => {
    const [layoutSettings, setLayoutSettings] = useState({});
    const { graphUpdateTrigger } = useGraph();

    const BorderImageNodeProgram = useMemo(() => {
        const NodeBorderCustomProgram = createNodeBorderProgram({
            borders: [
                {
                    size: { attribute: "borderSize", defaultValue: 6 },
                    color: { attribute: "borderColor" },
                },
                { size: { fill: true }, color: { attribute: "color" } },
            ],
        });

        const NodePictogramCustomProgram = createNodeImageProgram();

        return createNodeCompoundProgram([NodeBorderCustomProgram, NodePictogramCustomProgram]);
    }, []);

    const AnimatedStraightEdgeProgram = useMemo(() => {
        return createEdgeCompoundProgram([
            EdgeRectangleProgram,
            EdgeArrowHeadProgram,
            AnimatedDotProgram,
        ]);
    }, []);

    const SwitchEdgeProgram = useMemo(() => {
        return createEdgeCompoundProgram([EdgeRectangleProgram, SwitchSquareProgram]);
    }, []);

    const sigmaSettings = useMemo(
        () => ({
            minCameraRatio: 0.02,
            maxCameraRatio: 5,
            renderEdgeLabels: true,
            itemSizesReference: "screen",
            defaultDrawNodeLabel: drawLabel,
            defaultDrawNodeHover: drawHover,
            defaultNodeType: "node",
            labelDensity: 0.5,
            labelSize: 11,
            labelGridCellSize: 60,
            labelRenderedSizeThreshold: 14,
            hideEdgesOnMove: false,
            hideLabelsOnMove: true,
            zIndex: true,
            enableEdgeEvents: true,
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
        }),
        [],
    );

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
            graph={MultiUndirectedGraph}
            settings={{
                ...sigmaSettings,
                nodeReducer: customNodeReducer,
                edgeReducer: customEdgeReducer,
            }}
        >
            <Graph />
            <GraphEvents />
            <AnimatedEdgeTicker />
            <ControlsContainer position={"bottom-left"}>
                <ZoomControl />
                <FullScreenControl />
                <LayoutForceAtlas2Control settings={{ settings: layoutSettings }} />
            </ControlsContainer>
        </SigmaContainer>
    );
};

export default GraphRenderer;
