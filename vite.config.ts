import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// @ts-expect-error local mjs module
import { handleApiRequest } from './server/apiHandler.mjs';

function quantBlockApiPlugin(): Plugin {
  return {
    name: 'quantblock-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          const handled = await handleApiRequest(req, res);
          if (handled) return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), quantBlockApiPlugin()],
  server: {
    port: 5173,
  },
});
