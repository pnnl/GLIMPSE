import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve as pathResolve } from "path";

export default defineConfig({
    base: "./",
    plugins: [react()],
    // In a container the port is forwarded, so silently drifting to 5174 when
    // 5173 is taken would leave the forwarded port dead — fail loudly instead.
    server: { host: process.env.VITE_DEV_HOST, strictPort: process.env.VITE_STRICT_PORT === "1" },
    // `vite preview` serves the built bundle and proxies the backend, so a
    // Codespace (or any single-origin deployment) exposes one port instead of
    // two. Same-origin means no CORS and no cross-port auth — see the README's
    // Codespaces section.
    preview: {
        port: 4173,
        strictPort: true,
        host: process.env.VITE_DEV_HOST,
        // Vite rejects requests whose Host header isn't allowlisted, and a
        // Codespace is reached at <name>-4173.app.github.dev.
        allowedHosts: [".app.github.dev"],
        proxy: {
            // A 9500-node CIM parse holds the request open for minutes; the
            // default proxy timeouts would cut it short.
            "/api": { target: "http://127.0.0.1:5052", timeout: 0, proxyTimeout: 0 },
            "/socket.io": { target: "http://127.0.0.1:5052", ws: true },
        },
    },
    optimizeDeps: { entries: ["index.html"] },
    resolve: {
        alias: {
            graphology: pathResolve("node_modules/graphology/dist/graphology.cjs.js"),
        },
    },
});
