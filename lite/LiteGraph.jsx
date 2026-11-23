import "@react-sigma/core/lib/style.css";
import { SigmaContainer, ControlsContainer } from "@react-sigma/core";
import { MultiUndirectedGraph } from "graphology";
import { useGraph } from "../src/contexts/GraphContext";
import Graph from "../src/components/graph/Graph";
import WebGLRecovery from "../src/components/graph/WebGLRecovery";
import AreaHighlightLayers from "../src/components/graph/AreaHighlightLayers";
import GraphControls from "../src/components/graph/GraphControls";
import { OPTIONS } from "../src/components/graph/sigma-options";
import { useExploreEvents } from "../src/components/graph/explore-events";
import EdgeHoverCard from "../src/components/graph/EdgeHoverCard";
import AnimatedEdgeTicker from "../src/components/AnimatedEdgeTicker";
import DistributionAreaSelector from "../src/components/DistributionAreaSelector";
import ModelNameBadge from "../src/components/ModelNameBadge";
import LegendPanel from "../src/components/legend/LegendPanel";

const ExploreEvents = () => {
    useExploreEvents();
    return null;
};

// GraphRenderer minus editing, agents and simulation, which all pull in the socket client.
const LiteGraph = () => {
    const { graphUpdateTrigger } = useGraph();

    return (
        <SigmaContainer
            key={graphUpdateTrigger}
            style={{ backgroundColor: "#ffffff" }}
            graph={MultiUndirectedGraph}
            options={OPTIONS}
        >
            <Graph />
            <ExploreEvents />
            <EdgeHoverCard />
            <WebGLRecovery />
            <AnimatedEdgeTicker />
            <AreaHighlightLayers />
            <ControlsContainer style={{ border: "none", background: "none" }} position={"top-left"}>
                <DistributionAreaSelector />
            </ControlsContainer>
            <ControlsContainer style={{ border: "none", background: "none" }} position={"top-right"}>
                <LegendPanel />
            </ControlsContainer>
            <ControlsContainer style={{ border: "none", background: "none" }} position={"bottom-left"}>
                <GraphControls />
            </ControlsContainer>
            <ControlsContainer style={{ border: "none", background: "none" }} position={"bottom-right"}>
                <ModelNameBadge />
            </ControlsContainer>
        </SigmaContainer>
    );
};

export default LiteGraph;
