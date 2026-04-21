import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { resolve } from 'path';

// EvoSim deliberately skips the HTTPS + COOP/COEP dance that ChemSim
// requires. We do not use SharedArrayBuffer, wasm threading, or
// wasm-bindgen-rayon. Single-threaded WASM runs over plain HTTP.
export default defineConfig({
  plugins: [
    wasm(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  optimizeDeps: {
    exclude: ['evosim-engine'],
  },
});
