// FA2 worker speaking graphology's supervisor protocol, backed by fa2.wasm (see fa2-wasm/).
// Runs as many iterations as fit in BUDGET_MS per request, so layout speed isn't capped
// at one iteration per rendered frame. Big graphs split repulsion across helper workers.
// Falls back to graphology's JS iterate if WASM can't load.
import iterate from "graphology-layout-forceatlas2/iterate.js";
import { PPN, loadFa2, setSettings, view, write } from "./fa2-wasm";
import RepulseWorker from "./fa2-repulse.worker.js?worker&inline";

const BUDGET_MS = 16;
const PARALLEL_MIN_NODES = 1000;
const HELPERS = Math.min(8, (self.navigator.hardwareConcurrency || 2) - 1);

const ready = loadFa2().catch((err) => {
    console.warn("fa2.wasm failed to load, using JS ForceAtlas2:", err);
    return null;
});

let helpers = null; // spawned on first parallel step; [] once parallelism is off

const spawnHelpers = () =>
    Array.from({ length: HELPERS }, () => {
        const worker = new RepulseWorker();
        const helper = { worker, pending: null, synced: false };
        worker.addEventListener("message", ({ data }) => {
            const { resolve, reject } = helper.pending;
            helper.pending = null;
            if (data.error) reject(new Error(data.error));
            else resolve(data.forces);
        });
        worker.addEventListener("error", (e) => helper.pending?.reject(e));
        return helper;
    });

const repulseOn = (helper, message) =>
    new Promise((resolve, reject) => {
        helper.pending = { resolve, reject };
        helper.worker.postMessage(message);
    });

/** One iteration with repulsion fanned out over the helpers. */
const parallelStep = async (wasm, ptr, length, settings) => {
    wasm.fa2_reset();
    const order = length / PPN;
    const chunk = Math.ceil(order / helpers.length);
    const matrix = view(wasm, ptr, length);
    const xy = new Float32Array(order * 2);
    for (let n = 0, j = 0; n < length; n += PPN, j += 2) {
        xy[j] = matrix[n];
        xy[j + 1] = matrix[n + 1];
    }

    const slices = helpers.map((helper, i) => {
        const from = Math.min(order, i * chunk);
        const to = Math.min(order, from + chunk);
        const message = helper.synced ? { xy, from, to } : { nodes: matrix.slice(), from, to, settings };
        helper.synced = true;
        return repulseOn(helper, message).then((forces) => ({ from, forces }));
    });

    for (const { from, forces } of await Promise.all(slices)) {
        for (let j = 0, n = from * PPN; j < forces.length; j += 2, n += PPN) {
            matrix[n + 2] = forces[j];
            matrix[n + 3] = forces[j + 1];
        }
    }
    wasm.fa2_finish();
};

let edges;

self.addEventListener("message", async ({ data }) => {
    const wasm = await ready;
    const nodes = new Float32Array(data.nodes);
    const s = data.settings;
    const start = performance.now();

    if (data.edges) {
        // Edges come with each (re)start, when the graph may have changed: resync helpers
        edges = new Float32Array(data.edges);
        if (wasm) write(wasm, "fa2_edges", edges);
        helpers?.forEach((h) => (h.synced = false));
    }

    if (!wasm) {
        do iterate(s, nodes, edges);
        while (performance.now() - start < BUDGET_MS);
        self.postMessage({ nodes: nodes.buffer }, [nodes.buffer]);
        return;
    }

    setSettings(wasm, s);
    const ptr = write(wasm, "fa2_nodes", nodes);
    const parallel = HELPERS > 1 && nodes.length / PPN >= PARALLEL_MIN_NODES;
    if (parallel && !helpers) helpers = spawnHelpers();

    do {
        if (parallel && helpers.length) {
            try {
                await parallelStep(wasm, ptr, nodes.length, s);
                continue;
            } catch (err) {
                console.warn("FA2 helper workers failed, continuing single-threaded:", err);
                helpers.forEach((h) => h.worker.terminate());
                helpers = [];
            }
        }
        wasm.fa2_iterate(1);
    } while (performance.now() - start < BUDGET_MS);

    nodes.set(view(wasm, ptr, nodes.length));
    self.postMessage({ nodes: nodes.buffer }, [nodes.buffer]);
});
