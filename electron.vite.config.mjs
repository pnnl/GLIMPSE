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
      resolve: {
         alias: {
            "@renderer": resolve("src/renderer")
         }
      },
      plugins: [react()]
   }
   // server: {
   //   headers: {
   //     'Content-Security-Policy': "default-src 'self'; connect-src 'self' http://127.0.0.1:5051;"
   //   }
   // }
});
