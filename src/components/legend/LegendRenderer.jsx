import { useEffect, useMemo } from "react";
import { useLoadGraph, useSigma } from "@react-sigma/core";
import { MultiGraph } from "graphology";
import graphHelper from "../../graph-helper/GraphHelper";
import LegendGraphEvents from "./LegendGraphEvents";
import { SigmaContainer } from "@react-sigma/core";
import { EdgeRectangleProgram, createEdgeCompoundProgram } from "sigma/rendering";
import SwitchSquareProgram from "../../custom-programs/switch-program/SwitchSquareProgram";
import { createNodeBorderProgram, NodeBorderProgram } from "@sigma/node-border";
import { createNodeCompoundProgram } from "sigma/rendering";
import { createNodeImageProgram } from "@sigma/node-image";
import { drawLabel, drawShadow } from "../../utils/canvas-utils";
import { useGraph } from "../../contexts/GraphContext";

const LegendDarkModeSync = () => {
    const sigma = useSigma();
    const { darkMode } = useGraph();
    useEffect(() => {
        sigma.refresh();
    }, [darkMode, sigma]);
    return null;
};

const LegendContainerStyles = (darkMode) => ({
    backgroundColor: darkMode ? "#1D1D1D" : "#ffffff",
});

const LegendGraph = () => {
    const loadLegendGraph = useLoadGraph();
    const { graphUpdateTrigger } = useGraph();

    useEffect(() => {
        try {
            if (graphHelper.legendGraph.order > 0) {
                console.log("Loading legend graph with order:", graphHelper.legendGraph.order);
                loadLegendGraph(graphHelper.legendGraph);
            }
        } catch (error) {
            console.error("Error loading legend graph:", error);
        }
    }, [loadLegendGraph, graphUpdateTrigger]);

    return null;
};

const LegendRenderer = () => {
    const { darkMode } = useGraph();
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

    const SwitchEdgeProgram = useMemo(() => {
        return createEdgeCompoundProgram([EdgeRectangleProgram, SwitchSquareProgram]);
    }, []);

    return (
        <SigmaContainer
            style={LegendContainerStyles(darkMode)}
            settings={{
                allowInvalidContainer: true,
                renderEdgeLabels: true,
                defaultEdgeType: "straight",
                defaultDrawNodeLabel: drawLabel,
                defaultDrawNodeHover: drawShadow,
                labelSize: 12,
                defaultNodeType: "node",
                enableCameraPanning: false,
                enableCameraZooming: false,
                enableEdgeEvents: true,
                autoCenter: true,
                nodeProgramClasses: {
                    nodeImg: BorderImageNodeProgram,
                    node: NodeBorderProgram,
                },
                edgeProgramClasses: {
                    straight: EdgeRectangleProgram,
                    switch: SwitchEdgeProgram,
                },
            }}
            graph={MultiGraph}
        >
            <LegendGraph />
            <LegendGraphEvents />
            <LegendDarkModeSync />
        </SigmaContainer>
    );
};

export default LegendRenderer;
