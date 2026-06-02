import app from './app.js';

// Local dev / long-running server entrypoint.
// On Vercel the app is served as a serverless function (see /api/[...path].mjs).
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`ChargeFlow Agent server running on http://localhost:${PORT}`);
});
