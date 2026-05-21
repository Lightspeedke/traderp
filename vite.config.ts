import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function localApiPlugin(): Plugin {
  return {
    name: 'local-api-routes',
    configureServer(server) {
      server.middlewares.use(async (req: any, res: any, next) => {
        if (!req.url?.startsWith('/api/payhero/')) {
          return next();
        }

        const requestUrl = new URL(req.url, 'http://localhost');
        const pathname = requestUrl.pathname;
        const handlerPath =
          pathname === '/api/payhero/stk'
            ? '/api/payhero/stk.ts'
            : pathname === '/api/payhero/callback'
              ? '/api/payhero/callback.ts'
              : pathname === '/api/payhero/status'
                ? '/api/payhero/status.ts'
                : null;

        if (!handlerPath) {
          return next();
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        const bodyText = Buffer.concat(chunks).toString('utf-8');
        req.query = Object.fromEntries(requestUrl.searchParams.entries());
        try {
          req.body = bodyText ? JSON.parse(bodyText) : {};
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid JSON request body.' }));
          return;
        }

        res.status = (code: number) => {
          res.statusCode = code;
          return res;
        };
        res.json = (data: unknown) => {
          if (!res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', 'application/json');
          }
          res.end(JSON.stringify(data));
          return res;
        };
        res.send = (data: unknown) => {
          res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : String(data));
          return res;
        };

        try {
          const handlerModule = await server.ssrLoadModule(handlerPath);
          const handler = handlerModule.default;
          await handler(req, res);
        } catch (error) {
          console.error('Local API route error:', error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Local API route failed.' }));
          }
        }
      });
    },
  };
}

export default defineConfig(() => {
  const disableHmr = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [localApiPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: !disableHmr,
      watch: {
        ignored: ['**/db_users.json', '**/.env', '**/.env.*'],
      },
    },
  };
});
