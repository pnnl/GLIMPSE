import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

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
          index: resolve('src/renderer/index.html'),
          portal: resolve('src/renderer/portal/portal.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/')
      }
    },
    plugins: [react()]
  }
});
