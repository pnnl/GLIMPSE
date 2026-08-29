import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve as pathResolve } from "path";

export default defineConfig({
    base: "./",
    plugins: [react()],
    // In a container the port is forwarded, so silently drifting to 5174 when
    // 5173 is taken would leave the forwarded port dead — fail loudly instead.
    server: { host: process.env.VITE_DEV_HOST, strictPort: process.env.VITE_STRICT_PORT === "1" },
    optimizeDeps: { entries: ["index.html"] },
    resolve: {
        alias: {
            graphology: pathResolve("node_modules/graphology/dist/graphology.cjs.js"),
        },
    },
});
