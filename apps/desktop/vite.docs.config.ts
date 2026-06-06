import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'src/renderer/docs'),
  plugins: [react({ fastRefresh: false })],
  resolve: {
    alias: {
      '@kt-virtual-env/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@kt-virtual-env/k8s-discovery': resolve(
        __dirname,
        '../../packages/k8s-discovery/src/index.ts',
      ),
    },
  },
  server: {
    port: 5199,
    strictPort: true,
  },
});
