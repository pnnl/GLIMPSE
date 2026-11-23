import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve as pathResolve } from "path";

// GLIMPSE-lite: read-only static viewer served by the Grid Kitchen portal under /static/glimpse/.
export default defineConfig({
    root: "lite",
    base: "/static/glimpse/",
    plugins: [react()],
    build: {
        outDir: "../dist-lite",
        emptyOutDir: true,
        assetsInlineLimit: (file) => (file.endsWith(".wasm") ? true : undefined),
    },
    resolve: {
        alias: {
            graphology: pathResolve("node_modules/graphology/dist/graphology.cjs.js"),
        },
    },
});
