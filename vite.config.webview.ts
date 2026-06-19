import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  base: '',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    rollupOptions: {
      input: {
        table: resolve(__dirname, 'webview/index.html'),
        explorer: resolve(__dirname, 'webview-explorer/index.html'),
      },
    },
  },
  plugins: [react()],
});
