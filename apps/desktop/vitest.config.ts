import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@kt-virtual-env/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@kt-virtual-env/k8s-discovery': resolve(
        __dirname,
        '../../packages/k8s-discovery/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'node',
  },
});
