import { useEffect } from "react";
import { useLoadGraph, useSigma } from "@react-sigma/core";
import graphHelper from "../../graph-helper/GraphHelper";
import { useGraph } from "../../contexts/GraphContext";

const Graph = () => {
    const loadGraph = useLoadGraph();
    const sigma = useSigma();
    const { graphUpdateTrigger } = useGraph();

    useEffect(() => {
        loadGraph(graphHelper.graph);
        console.log("graph loaded with order:", graphHelper.graph.order);

        graphHelper.sigmaInstance = sigma;

        graphHelper.graph = sigma.getGraph();
    }, [sigma, loadGraph, graphUpdateTrigger]);

    return null;
};

export default Graph;
