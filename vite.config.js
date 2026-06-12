import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
   // Relative base so the built app works both from a web server and when
   // loaded via file:// inside the Electron shell.
   base: "./",
   plugins: [react()],
   // Only scan the real entry point — keeps the dep scanner out of the
   // Electron/PyInstaller build outputs (release/, local-server/build/).
   optimizeDeps: { entries: ["index.html"] },
});
