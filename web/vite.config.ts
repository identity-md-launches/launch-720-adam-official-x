import { defineConfig } from 'vite';
// base './' keeps asset URLs relative for gateway subpaths. viem is imported dynamically by api.ts, so Rollup emits it as a separate lazily loaded chunk.
export default defineConfig({base:'./',build:{outDir:'../dist',emptyOutDir:true,rollupOptions:{output:{manualChunks:{react:['react','react-dom']}}}}});
