// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
    port: 5173},
  plugins: [react()],
  build: {
    // IMPORTANT: do not externalize react for a single-host SPA
    rollupOptions: {
      external: [], // ensure react/react-dom are bundled
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", 'clsx'],
    exclude: [], // don't exclude react/react-dom
  },
  resolve: {
    alias: {
      // If you previously aliased to preact, remove it (or keep intentionally)
      // "react": "preact/compat",
      // "react-dom/test-utils": "preact/test-utils",
      // "react-dom": "preact/compat",
    },
  sourcemap: true,   // debugging in console
  },
});