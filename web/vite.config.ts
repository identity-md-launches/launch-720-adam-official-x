import { defineConfig } from 'vite';
export default defineConfig({base:'./',build:{outDir:'../dist',emptyOutDir:true,rollupOptions:{output:{manualChunks:{react:['react','react-dom'],evm:['viem']}}}}});
