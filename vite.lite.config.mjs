import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve as pathResolve } from "path";
import { readFileSync } from "fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// GLIMPSE-lite: read-only static viewer served by the Grid Kitchen portal under /static/glimpse/.
export default defineConfig({
    root: "lite",
    base: "/static/glimpse/",
    plugins: [react()],
    // Shared src/ components may show the app version (see vite.config.mjs).
    define: { __APP_VERSION__: JSON.stringify(version) },
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
