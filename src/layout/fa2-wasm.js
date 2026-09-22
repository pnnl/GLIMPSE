// Shared by the FA2 workers: loads fa2.wasm (see fa2-wasm/) and moves matrices in/out.
import initWasm from "./fa2.wasm?init";

export const PPN = 10; // floats per node, graphology's layout

export const loadFa2 = () => initWasm().then((instance) => instance.exports);

export const setSettings = (wasm, s) =>
    wasm.fa2_settings(
        s.adjustSizes, s.barnesHutOptimize, s.barnesHutTheta, s.scalingRatio, s.gravity,
        s.strongGravityMode, s.linLogMode, s.outboundAttractionDistribution, s.edgeWeightInfluence, s.slowDown,
    );

/** Copies `data` into the buffer `alloc` sizes; returns its pointer. */
export const write = (wasm, alloc, data) => {
    // Allocate before viewing memory: growth detaches earlier views
    const ptr = wasm[alloc](data.length);
    new Float32Array(wasm.memory.buffer, ptr, data.length).set(data);
    return ptr;
};

export const view = (wasm, ptr, length) => new Float32Array(wasm.memory.buffer, ptr, length);
