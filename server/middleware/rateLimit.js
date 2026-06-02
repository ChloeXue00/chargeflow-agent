/**
 * Dependency-free, in-memory sliding-window rate limiter.
 *
 * The public demo runs against a real Anthropic API key, so the chat endpoint
 * needs a guard against abuse / runaway cost. This is intentionally simple
 * (single-instance, in-memory) — appropriate for a single Render web service.
 *
 * Env overrides:
 * - RATE_LIMIT_WINDOW_MS  (default 60_000)
 * - RATE_LIMIT_MAX        (default 20 requests per window per IP)
 */
export function rateLimit({
  windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max = Number(process.env.RATE_LIMIT_MAX) || 20,
} = {}) {
  const hits = new Map(); // ip -> number[] (timestamps)

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const windowStart = now - windowMs;

    const timestamps = (hits.get(ip) || []).filter((t) => t > windowStart);
    timestamps.push(now);
    hits.set(ip, timestamps);

    // Opportunistic cleanup so the map doesn't grow unbounded.
    if (hits.size > 5000) {
      for (const [key, value] of hits) {
        if (value.every((t) => t <= windowStart)) hits.delete(key);
      }
    }

    const remaining = Math.max(0, max - timestamps.length);
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));

    if (timestamps.length > max) {
      const retryAfter = Math.ceil((timestamps[0] + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试。 / Too many requests, please slow down.',
        retryAfter,
      });
    }

    return next();
  };
}
