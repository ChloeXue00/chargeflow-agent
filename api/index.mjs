import app from '../server/app.js';

/**
 * Vercel serverless entrypoint — the whole Express app behind one function.
 *
 * vercel.json rewrites every /api/* request to /api/index with the original
 * path carried in a __path query param (Vercel's filesystem catch-all routing
 * mis-handles multi-segment paths, so we route explicitly and reconstruct).
 * Here we restore req.url to the original /api/... path (preserving any real
 * query params) so the Express /api/* routes match exactly as they do locally.
 */
export default function handler(req, res) {
  const url = new URL(req.url, 'http://internal');
  const original = url.searchParams.get('__path');

  if (original) {
    url.searchParams.delete('__path');
    const rest = url.searchParams.toString();
    req.url = original + (rest ? `?${rest}` : '');
  } else if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : `/${req.url}`);
  }

  return app(req, res);
}
