import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRouter from './routes/chat.js';
import { getCalendarEvents, createCalendarEvent } from './services/tools.js';
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

app.get('/api/calendar/events', async (req, res) => {
  try {
    const events = await getCalendarEvents(req.query);
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load calendar events.' });
  }
});

app.post('/api/calendar/events', async (req, res) => {
  try {
    const event = await createCalendarEvent(req.body);
    res.status(201).json({ event });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to create calendar event.' });
  }
});

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
