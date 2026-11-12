import { defineConfig } from 'vite';

const API_TARGET = process.env.API_URL || 'http://localhost:3001';
const WEB_PORT = Number(process.env.WEB_PORT) || 5173;

export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: true },
  server: {
    port: WEB_PORT,
    strictPort: true,
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } },
  },
  preview: {
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    environmentMatchGlobs: [['tests/server/**', 'node']],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js', 'server/**/*.js', 'shared/**/*.js'],
      exclude: ['src/main.js', 'server/index.js'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});
