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
        // Native modules cannot be bundled — ship via node_modules in the VSIX.
        '@duckdb/node-api',
        '@duckdb/node-bindings',
        /^@duckdb\/node-bindings-/,
        'fs',
        'path',
        'crypto',
      ],
    },
    sourcemap: true,
    target: 'node18',
  },
});
