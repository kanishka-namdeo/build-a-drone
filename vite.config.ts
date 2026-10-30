import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          engine: ['./src/engine/core.ts', './src/engine/frames.ts', './src/engine/materials.ts'],
          crafts: ['./src/crafts/index.ts']
        }
      }
    }
  },
  server: { port: 5173 },
  test: {
    environment: 'node',
    // Playwright specs live in tests/e2e and run via `npm run test:e2e`
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**']
  }
} as never);
