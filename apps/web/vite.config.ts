import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { pwaPrecache } from './build/pwa-plugin.ts';

// Repository root (apps/web/vite.config.ts -> ../../). The verification cases live there.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  // Subruta de despliegue. '/' por defecto; en GitHub Pages: VITE_BASE=/OpenGeoSlide/ (pages.yml usa el nombre exacto del repo: /${{ github.event.repository.name }}/, con mayúsculas).
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), pwaPrecache()],
  // The worker is loaded as an ES module; the optional wasm glob needs code splitting,
  // which the default 'iife' worker format does not support.
  worker: { format: 'es' },
  server: {
    host: '127.0.0.1',
    port: 5173,
    fs: { allow: [repoRoot] },
  },
  preview: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
