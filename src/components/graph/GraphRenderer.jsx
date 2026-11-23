import "@react-sigma/core/lib/style.css";
import { useEffect } from "react";
import { SigmaContainer, ControlsContainer } from "@react-sigma/core";
import { MultiUndirectedGraph } from "graphology";
import { setCanvasDarkMode } from "../../utils/canvas-utils";
import graphHelper from "../../graph-helper/GraphHelper";
import GraphEvents from "./GraphEvents";
import EdgeHoverCard from "./EdgeHoverCard";
import { useGraph } from "../../contexts/GraphContext";
import Graph from "./Graph";
import WebGLRecovery from "./WebGLRecovery";
import AnimatedEdgeTicker from "../AnimatedEdgeTicker";
import DistributionAreaSelector from "../DistributionAreaSelector";
import AgentPanel from "../agents/AgentPanel";
import AreaHighlightLayers from "./AreaHighlightLayers";
import GraphControls from "./GraphControls";
import SimulationIdBadge from "../SimulationIdBadge";
import ModelNameBadge from "../ModelNameBadge";
import LegendPanel from "../legend/LegendPanel";
import ViolationLegend from "../legend/ViolationLegend";
import areaHighlight from "../../graph-helper/area-highlight";
import { setSeverityDarkMode } from "../../utils/electrical";
import { OPTIONS } from "./sigma-options";

const GraphRenderer = () => {
    const { graphUpdateTrigger, darkMode, mapShown } = useGraph();

    // Everything drawn on the canvas follows the background it sits on, not the
    // app chrome. The leaflet map's tiles are light in both themes (see
    // GraphControls), so while the map is up the graph keeps its light colors —
    // otherwise dark mode's pale overhead lines all but vanish over the tiles.
    const canvasDark = darkMode && !mapShown;

    useEffect(() => {
        setCanvasDarkMode(canvasDark);
        setSeverityDarkMode(canvasDark);
        // Repaints every element that is still carrying its themed color, which
        // is what makes the theme's light/dark color pairs take effect.
        graphHelper.setDarkMode(canvasDark);
        areaHighlight.setDarkMode(canvasDark);
        if (graphHelper.sigmaInstance) graphHelper.sigmaInstance.refresh();
        // The DOM panels rendered inside the SigmaContainer read their colors from
        // the module state set above (the flattened theme, the severity scale).
        // Their own render pass runs before this effect, so a darkMode-keyed effect
        // in them would read the previous mode's colors — they wait on this instead.
        window.dispatchEvent(new CustomEvent("graph-theme-changed"));
    }, [canvasDark]);

    return (
        <SigmaContainer
            key={graphUpdateTrigger}
            className={darkMode ? "sigma-dark" : ""}
            style={{ backgroundColor: darkMode ? "#1D1D1D" : "#ffffff" }}
            graph={MultiUndirectedGraph}
            options={OPTIONS}
        >
            <Graph />
            <GraphEvents />
            <EdgeHoverCard />
            <WebGLRecovery />
            <AnimatedEdgeTicker />
            {/* Renders nothing; owns the distribution-area contour layers for
                every consumer of the shared selection (area tree, agents). */}
            <AreaHighlightLayers />
            <ControlsContainer style={{ border: "none", background: "none" }} position={"top-left"}>
                <DistributionAreaSelector />
            </ControlsContainer>
            <ControlsContainer style={{ border: "none", background: "none" }} position={"top-right"}>
                <ViolationLegend />
                <LegendPanel />
                <AgentPanel />
            </ControlsContainer>
            <ControlsContainer style={{ border: "none", background: "none" }} position={"bottom-left"}>
                <GraphControls />
            </ControlsContainer>
            <ControlsContainer style={{ border: "none", background: "none" }} position={"bottom-right"}>
                <ModelNameBadge />
                <SimulationIdBadge />
            </ControlsContainer>
        </SigmaContainer>
    );
};

export default GraphRenderer;
