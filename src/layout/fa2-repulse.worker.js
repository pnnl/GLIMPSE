// Helper for fa2.worker.js: repulsion for one slice of nodes, returned as [dx, dy] pairs.
// Gets the full node matrix once, then only x/y per iteration (mass/size don't change).
import { PPN, loadFa2, setSettings, view, write } from "./fa2-wasm";

const ready = loadFa2();
let ptr, length;

self.addEventListener("message", async ({ data: { nodes, xy, from, to, settings } }) => {
    try {
        const wasm = await ready;
        if (nodes) {
            setSettings(wasm, settings);
            ptr = write(wasm, "fa2_nodes", nodes);
            length = nodes.length;
        } else {
            const matrix = view(wasm, ptr, length);
            for (let n = 0, j = 0; n < length; n += PPN, j += 2) {
                matrix[n] = xy[j];
                matrix[n + 1] = xy[j + 1];
            }
        }
        wasm.fa2_repulse(from, to);

        const matrix = view(wasm, ptr, length);
        const forces = new Float32Array((to - from) * 2);
        for (let i = from, j = 0; i < to; i++, j += 2) {
            forces[j] = matrix[i * PPN + 2];
            forces[j + 1] = matrix[i * PPN + 3];
        }
        self.postMessage({ forces }, [forces.buffer]);
    } catch (err) {
        self.postMessage({ error: String(err) });
    }
});
