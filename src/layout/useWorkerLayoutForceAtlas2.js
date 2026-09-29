import { useEffect, useRef } from "react";
import { useWorkerLayoutFactory } from "@react-sigma/layout-core";
import FA2LayoutSupervisor from "graphology-layout-forceatlas2/worker";
import Fa2Worker from "./fa2.worker.js?worker&inline";

const BARNES_HUT_MIN_NODES = 2_500;

export const FA2_DEFAULT_SETTINGS = {
    barnesHutTheta: 0.5,
    linLogMode: false,
    adjustSizes: false,
    edgeWeightInfluence: 1,
    outboundAttractionDistribution: false,
    scalingRatio: 1,
    gravity: 1,
    strongGravityMode: false,
    slowDown: 5,
};

// graphology's supervisor, swapping its JS worker for the WASM one
class WasmFA2LayoutSupervisor extends FA2LayoutSupervisor {
    // The factory builds the supervisor once and ignores later settings, so it reads a ref
    constructor(graph, params) {
        super(graph, params);
        this.liveSettings = params.liveSettings;
    }

    // Decided per start: the hook is created before Graph.jsx loads the model into Sigma
    start() {
        this.settings.barnesHutOptimize = this.graph.order > BARNES_HUT_MIN_NODES;
        return super.start();
    }

    // Settings ride along with every request, so edits apply to a running layout
    askForIterations(withEdges) {
        Object.assign(this.settings, this.liveSettings.current);
        return super.askForIterations(withEdges);
    }

    spawnWorker() {
        if (this.worker) this.worker.terminate();

        this.worker = new Fa2Worker();
        this.worker.addEventListener("message", this.handleMessage);

        if (this.running) {
            this.running = false;
            this.start();
        }
    }
}

/** Drop-in for @react-sigma/layout-forceatlas2's hook, running FA2 in WASM. */
export const useWorkerLayoutForceAtlas2 = ({ settings = FA2_DEFAULT_SETTINGS, ...options } = {}) => {
    const liveSettings = useRef(settings);
    useEffect(() => {
        liveSettings.current = settings;
    }, [settings]);
    return useWorkerLayoutFactory(WasmFA2LayoutSupervisor, { ...options, settings, liveSettings });
};
