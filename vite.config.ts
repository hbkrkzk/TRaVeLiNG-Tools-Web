import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"

// Mock/Local implementation of API handlers for development
const apiPlugin = () => ({
  name: 'api-handler',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/')) {
        return next();
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathname = url.pathname;

      try {
        if (pathname === '/api/affiliate') {
          const deepLink = url.searchParams.get('deepLink');
          const programId = url.searchParams.get('programId') || process.env.IMPACT_PROGRAM_ID || '13416';
          const partnerId = process.env.IMPACT_PARTNER_ID;
          const apiKey = process.env.IMPACT_API_KEY;

          if (!deepLink) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'deepLink parameter is required' }));
            return;
          }

          if (!partnerId || !apiKey) {
            // If keys are missing, return a dummy tracking URL for testing
            console.warn('Missing IMPACT_PARTNER_ID or IMPACT_API_KEY. Returning dummy URL.');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ TrackingURL: `https://impact.com/dummy?url=${encodeURIComponent(deepLink)}` }));
            return;
          }

          const credentials = Buffer.from(`${partnerId}:${apiKey}`).toString('base64');
          const endpoint = `https://api.impact.com/Mediapartners/${partnerId}/Programs/${programId}/TrackingLinks`;
          
          const apiRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Accept': 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ DeepLink: deepLink, Type: 'vanity' }).toString(),
          });

          if (!apiRes.ok) {
            const errorText = await apiRes.text();
            res.statusCode = apiRes.status;
            res.end(JSON.stringify({ error: `Impact API error: ${errorText}` }));
            return;
          }

          const data = await apiRes.json();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return;
        }

        if (pathname === '/api/expand') {
          const shortUrl = url.searchParams.get('url');
          if (!shortUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'url parameter is required' }));
            return;
          }

          const target = `http://app.tree-web.net/short2longurl/api.cgi?url=${encodeURIComponent(shortUrl)}`;
          const apiRes = await fetch(target);
          const body = await apiRes.text();
          
          // Simple regex-based extraction as in expand.ts
          const matched = body.match(/"?long"?\s*:\s*"([^"]+)"/);
          const longUrl = matched?.[1];

          if (!longUrl) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to expand' }));
            return;
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ longUrl }));
          return;
        }

        if (pathname === '/api/shorten') {
          const longUrl = url.searchParams.get('url');
          if (!longUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'url parameter is required' }));
            return;
          }

          const apiKey = "7d2ad123799e3bdd05a3553b5d2f7968";
          const target = `https://xgd.io/V1/shorten?url=${encodeURIComponent(longUrl)}&key=${apiKey}`;
          const apiRes = await fetch(target);
          const data = await apiRes.json();

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return;
        }

        // Add other API handlers if needed...
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
        return;
      }

      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile(), apiPlugin()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
})
