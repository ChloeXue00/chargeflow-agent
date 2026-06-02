import app from '../server/app.js';

/**
 * Vercel serverless entrypoint — the whole Express app behind a single
 * catch-all function. Vercel routes every /api/* request here; we keep the
 * /api prefix on req.url so the app's /api/* routes match regardless of how
 * Vercel forwards the path.
 */
export default function handler(req, res) {
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : `/${req.url}`);
  }
  return app(req, res);
}
