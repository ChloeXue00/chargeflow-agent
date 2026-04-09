import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRouter from './routes/chat.js';
import { getVehicleStatus, searchNearbyStations, getCalendarEvents, getPendingChargeTasks } from './services/tools.js';
import { getMemorySnapshot } from './services/memory.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'chargeflow-agent-server' });
});

app.use('/api/chat', chatRouter);

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

app.listen(PORT, () => {
  console.log(`ChargeFlow Agent server running on http://localhost:${PORT}`);
});
