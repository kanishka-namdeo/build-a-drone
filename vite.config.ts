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
    environment: 'node'
  }
} as never);
