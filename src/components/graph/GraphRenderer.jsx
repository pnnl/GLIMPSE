import "@react-sigma/core/lib/style.css";
import { useEffect, useMemo, useState } from "react";
import {
    SigmaContainer,
    ControlsContainer,
    ZoomControl,
    FullScreenControl,
} from "@react-sigma/core";
import { LayoutForceAtlas2Control } from "@react-sigma/layout-forceatlas2";
import { MultiUndirectedGraph } from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { createNodeImageProgram } from "@sigma/node-image";
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
} from "sigma/rendering";
import AnimatedDotProgram from "../../custom-programs/animated-dot-program/AnimatedDotProgram";
import AnimatedEdgeTicker from "../AnimatedEdgeTicker";

const GraphRenderer = () => {
    const [layoutSettings, setLayoutSettings] = useState({});
    const { graphUpdateTrigger } = useGraph();

    const BorderImageNodeProgram = useMemo(() => {
        const NodeBorderCustomProgram = createNodeBorderProgram({
            borders: [
                {
                    size: { attribute: "borderSize", defaultValue: 2 },
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

    const sigmaSettings = useMemo(
        () => ({
            renderEdgeLabels: true,
            itemSizesReference: "screen",
            defaultDrawNodeLabel: drawLabel,
            defaultDrawNodeHover: drawHover,
            defaultNodeType: "node",
            labelDensity: 0.5,
            labelSize: 11,
            labelGridCellSize: 60,
            labelRenderedSizeThreshold: 6,
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
            return { ...attrs, color: "rgba(145, 145, 145, 0.7)", label: "", size: 1 };
        }

        return { ...attrs, size: attrs.size * 1.5 };
    };

    useEffect(() => {
        if (graphHelper.graph.order > 0) {
            setLayoutSettings(forceAtlas2.inferSettings(graphHelper.graph));
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
