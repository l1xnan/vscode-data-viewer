import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/extension.ts'),
      formats: ['cjs'],
      fileName: () => 'extension.js',
    },
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: [
        'vscode',
        '@duckdb/node-api',
        '@duckdb/node-bindings',
        'xlsx',
        'fs',
        'path',
        'crypto',
      ],
    },
    sourcemap: true,
    target: 'node18',
  },
});
