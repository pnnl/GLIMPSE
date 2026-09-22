import { useWorkerLayoutFactory } from "@react-sigma/layout-core";
import FA2LayoutSupervisor from "graphology-layout-forceatlas2/worker";
import Fa2Worker from "./fa2.worker.js?worker&inline";

const BARNES_HUT_MIN_NODES = 2_500;

// graphology's supervisor, swapping its JS worker for the WASM one
class WasmFA2LayoutSupervisor extends FA2LayoutSupervisor {
    // Decided per start: the hook is created before Graph.jsx loads the model into Sigma
    start() {
        this.settings.barnesHutOptimize = this.graph.order > BARNES_HUT_MIN_NODES;
        return super.start();
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
export const useWorkerLayoutForceAtlas2 = (options = {}) =>
    useWorkerLayoutFactory(WasmFA2LayoutSupervisor, options);
