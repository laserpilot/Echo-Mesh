import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';

/** /conduct → conduct.html in dev (the Node server does the same in production) */
const prettyUrls: Plugin = {
  name: 'pretty-urls',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/conduct' || req.url?.startsWith('/conduct?')) req.url = req.url.replace('/conduct', '/conduct.html');
      next();
    });
  },
};

export default defineConfig({
  plugins: [svelte(), prettyUrls],
  server: {
    host: true,
    port: 5173,
    // only for non-timing HTTP; the WebSocket connects to the Node server directly
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    rollupOptions: { input: { index: 'index.html', conduct: 'conduct.html' } },
  },
});
