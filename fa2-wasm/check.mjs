// Checks the WASM port against graphology's JS iterate() and times both.
// Run from the repo root: node fa2-wasm/check.mjs [nodes]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const iterate = require("graphology-layout-forceatlas2/iterate.js");
const helpers = require("graphology-layout-forceatlas2/helpers.js");
const defaults = require("graphology-layout-forceatlas2/defaults.js");
const { MultiUndirectedGraph } = require("graphology");

const bytes = readFileSync(new URL("../src/layout/fa2.wasm", import.meta.url));
const load = async () => (await WebAssembly.instantiate(bytes)).instance.exports;
const wasm = await load();
const slices = await Promise.all([1, 2, 3].map(load)); // stand-ins for the helper workers

// Random tree with a few loops, roughly the shape of a feeder model
const order = Number(process.argv[2] ?? 7000);
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const graph = new MultiUndirectedGraph();
for (let i = 0; i < order; i++) {
    graph.addNode(i, { x: rand() * 100, y: rand() * 100 });
    if (i > 0) graph.addEdge(i, Math.floor(rand() * i));
}
for (let i = 0; i < order / 50; i++) graph.addEdge(Math.floor(rand() * order), Math.floor(rand() * order));

const setSettings = (w, s) =>
    w.fa2_settings(
        s.adjustSizes, s.barnesHutOptimize, s.barnesHutTheta, s.scalingRatio, s.gravity,
        s.strongGravityMode, s.linLogMode, s.outboundAttractionDistribution, s.edgeWeightInfluence, s.slowDown,
    );

// Allocate before viewing memory: growth detaches earlier views
const write = (w, alloc, data) => {
    const ptr = w[alloc](data.length);
    new Float32Array(w.memory.buffer, ptr, data.length).set(data);
    return ptr;
};

const wasmIterate = (s, nodes, edges, iterations) => {
    setSettings(wasm, s);
    const ptr = write(wasm, "fa2_nodes", nodes);
    write(wasm, "fa2_edges", edges);
    wasm.fa2_iterate(iterations);
    nodes.set(new Float32Array(wasm.memory.buffer, ptr, nodes.length));
};

// What fa2.worker.js does with helper workers, run sequentially
const slicedIterate = (s, nodes, edges, iterations) => {
    setSettings(wasm, s);
    const ptr = write(wasm, "fa2_nodes", nodes);
    write(wasm, "fa2_edges", edges);
    const order = nodes.length / 10;
    const chunk = Math.ceil(order / slices.length);
    for (let it = 0; it < iterations; it++) {
        wasm.fa2_reset();
        const snapshot = new Float32Array(wasm.memory.buffer, ptr, nodes.length).slice();
        slices.forEach((h, i) => {
            const from = Math.min(order, i * chunk);
            const to = Math.min(order, from + chunk);
            setSettings(h, s);
            const hp = write(h, "fa2_nodes", snapshot);
            h.fa2_repulse(from, to);
            const hm = new Float32Array(h.memory.buffer, hp, snapshot.length);
            const m = new Float32Array(wasm.memory.buffer, ptr, nodes.length);
            for (let n = from * 10; n < to * 10; n += 10) {
                m[n + 2] = hm[n + 2];
                m[n + 3] = hm[n + 3];
            }
        });
        wasm.fa2_finish();
    }
    nodes.set(new Float32Array(wasm.memory.buffer, ptr, nodes.length));
};

const maxDiff = (a, b) => {
    let d = 0;
    for (let i = 0; i < a.length; i += 10) d = Math.max(d, Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]));
    return d;
};

const variants = [
    { barnesHutOptimize: true, barnesHutTheta: 0.5, slowDown: 5 },
    { barnesHutOptimize: false, slowDown: 5 },
    { barnesHutOptimize: true, linLogMode: true, outboundAttractionDistribution: true },
    { barnesHutOptimize: false, adjustSizes: true, strongGravityMode: true },
];

let failed = false;
for (const v of variants) {
    const s = { ...defaults, ...v };
    const { nodes, edges } = helpers.graphToByteArrays(graph, () => 1);
    const js = nodes.slice();
    const ws = nodes.slice();
    const ps = nodes.slice();
    const iterations = s.barnesHutOptimize ? 50 : 5;

    let t = performance.now();
    for (let i = 0; i < iterations; i++) iterate(s, js, edges);
    const jsMs = (performance.now() - t) / iterations;

    t = performance.now();
    wasmIterate(s, ws, edges, iterations);
    const wasmMs = (performance.now() - t) / iterations;

    slicedIterate(s, ps, edges, iterations);

    // Single-threaded must match the JS exactly. Barnes-Hut slices sum in the same order,
    // so they match too; O(n²) slices sum full rows instead of pairs, so allow rounding drift.
    const exact = maxDiff(js, ws);
    const sliced = maxDiff(ws, ps);
    const ok = exact === 0 && sliced < (s.barnesHutOptimize ? 1e-9 : 1e-2);
    failed ||= !ok;
    console.log(
        `${ok ? "ok  " : "FAIL"} ${JSON.stringify(v)}\n     js ${jsMs.toFixed(2)} ms/iter, wasm ${wasmMs.toFixed(2)} ms/iter ` +
            `(${(jsMs / wasmMs).toFixed(2)}x); diff vs js ${exact.toExponential(2)}, sliced vs single ${sliced.toExponential(2)}`,
    );
}
process.exit(failed ? 1 : 0);
