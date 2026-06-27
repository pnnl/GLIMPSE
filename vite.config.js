import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve as pathResolve } from "path";

export default defineConfig({
    base: "./",
    plugins: [react()],
    optimizeDeps: { entries: ["index.html"] },
    resolve: {
        alias: {
            graphology: pathResolve("node_modules/graphology/dist/graphology.cjs.js"),
        },
    },
});
