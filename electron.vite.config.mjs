import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
   main: {
      plugins: [externalizeDepsPlugin()]
   },
   preload: {
      plugins: [externalizeDepsPlugin()]
   },
   renderer: {
      build: {
         rollupOptions: {
            input: {
               index: resolve("src/renderer/index.html"),
               studio: resolve("src/renderer/object-studio/studio.html")
            }
         }
      },
      resolve: {
         alias: {
            "@renderer": resolve("src/renderer")
         }
      },
      plugins: [react()]
   },
   server: {
      open: false
   }
});
