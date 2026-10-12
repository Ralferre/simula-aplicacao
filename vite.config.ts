import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Rev01 is a 100% client-side app with no backend. The former /api proxy to
// localhost:8787 (Rev00) has been removed.
//
// `base` controls the asset path prefix. It defaults to '/' (correct for local
// dev and for nginx serving at root). GitHub Pages serves at a subpath
// (https://<user>.github.io/<repo>/), so the deploy workflow sets
// VITE_BASE=/<repo>/ at build time.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
  },
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist',
  },
});
