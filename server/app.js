import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRouter from './routes/chat.js';
import { rateLimit } from './middleware/rateLimit.js';
import { getVehicleStatus, searchNearbyStations, getCalendarEvents, getPendingChargeTasks } from './services/tools.js';
import { getMemorySnapshot } from './services/memory.js';

dotenv.config();

const app = express();

// CORS: when CLIENT_ORIGIN is set, restrict to that allowlist (comma-separated).
// When unset (local dev, or same-origin full-stack deploy on Vercel), reflect the
// request origin — the public endpoint is still protected by rate limiting + caps.
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);

app.use(cors(
  allowedOrigins.length
    ? {
        origin(origin, callback) {
          if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
          return callback(new Error(`Origin ${origin} not allowed by CORS`));
        },
        credentials: true,
      }
    : { origin: true, credentials: true }
));
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'chargeflow-agent-server' });
});

// The chat endpoint hits the Anthropic API, so it is rate limited to protect cost.
app.use('/api/chat', rateLimit(), chatRouter);

/**
 * Vehicle status endpoint for the cockpit dashboard.
 */
app.get('/api/vehicle/status', async (_req, res) => {
  try {
    const status = await getVehicleStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load vehicle status.' });
  }
});

/**
 * Charging station search endpoint.
 */
app.get('/api/stations', async (req, res) => {
  try {
    const stations = await searchNearbyStations(req.query);
    res.json({ stations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search stations.' });
  }
});

/**
 * Calendar events endpoint for trip planning.
 */
app.get('/api/calendar/events', async (req, res) => {
  try {
    const events = await getCalendarEvents(req.query);
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load calendar events.' });
  }
});

/**
 * Pending charge tasks endpoint.
 */
app.get('/api/tasks/pending', async (_req, res) => {
  try {
    const tasks = await getPendingChargeTasks();
    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load pending tasks.' });
  }
});

/**
 * Durable memory inspection endpoint.
 */
app.get('/api/memory', async (_req, res) => {
  try {
    const memory = await getMemorySnapshot();
    res.json(memory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load memory.' });
  }
});

export default app;
