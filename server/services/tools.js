import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Static seed data is imported (so it gets bundled into the serverless function);
// fs reads of un-imported files would 404 on Vercel.
import vehicleState from '../data/vehicle_state.json' with { type: 'json' };
import stationsData from '../data/charging_stations.json' with { type: 'json' };
import calendarData from '../data/calendar.json' with { type: 'json' };
import pendingSeed from '../data/pending_tasks.json' with { type: 'json' };

import { amapEnabled, searchChargingStations } from './amap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pendingTasksPath = path.join(__dirname, '..', 'data', 'pending_tasks.json');

// Vercel's filesystem is read-only, so the one mutable doc (pending tasks) lives
// in memory (per warm instance). Locally we persist to disk for a nicer dev loop.
const canPersist = !process.env.VERCEL;
let pendingState = structuredClone(pendingSeed);

// --- Schemas ---

const vehicleStatusSchema = z.object({}).optional();

const searchStationsSchema = z.object({
  // coerce so HTTP query strings ("5") and agent tool numbers (5) both parse
  maxDistance_km: z.coerce.number().optional().default(10),
  minPower_kW: z.coerce.number().optional().default(0),
  network: z.string().optional(),
  sortBy: z.enum(['distance', 'speed', 'price', 'availability']).optional().default('distance'),
});

const calendarQuerySchema = z.object({
  date: z.string().optional(),
  rangeStart: z.string().optional(),
  rangeEnd: z.string().optional(),
  keyword: z.string().optional(),
});

const chargePlanSchema = z.object({
  stationId: z.string().min(1),
  targetSoc: z.number().min(20).max(100).optional().default(80),
  reason: z.string().optional().default(''),
  urgent: z.boolean().optional().default(false),
});

const tripEnergySchema = z.object({
  distance_km: z.coerce.number().positive(),
  roundTrip: z.boolean().optional().default(true),
  reserveRange_km: z.coerce.number().min(10).max(80).optional().default(20),
});

const pendingTasksSchema = z.object({}).optional();

// --- Helpers ---

async function readPending() {
  if (canPersist) {
    try {
      return JSON.parse(await fs.readFile(pendingTasksPath, 'utf-8'));
    } catch {
      // fall back to in-memory state if the file is unavailable
    }
  }
  return pendingState;
}

async function writePending(data) {
  pendingState = data;
  if (canPersist) {
    try {
      await fs.writeFile(pendingTasksPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // read-only FS (e.g. Vercel) — keep the in-memory copy only
    }
  }
}

// --- Tool Implementations ---

/**
 * Get current vehicle status: SOC, range, location, navigation state.
 */
export async function getVehicleStatus() {
  return structuredClone(vehicleState);
}

/**
 * Search nearby charging stations with optional filters.
 */
export async function searchNearbyStations(input = {}) {
  const { maxDistance_km, minPower_kW, network, sortBy } = searchStationsSchema.parse(input);

  // Prefer real Amap data when configured; fall back to bundled mock data.
  let stations = stationsData;
  if (amapEnabled()) {
    try {
      const { lng, lat } = vehicleState.currentLocation || {};
      const real = await searchChargingStations({ lng, lat, radius_m: maxDistance_km * 1000 });
      if (real.length) stations = real;
    } catch (error) {
      console.warn('Amap station search failed, using mock data:', error.message);
    }
  }

  const filtered = stations.filter((s) => {
    if (typeof s.distance_km === 'number' && s.distance_km > maxDistance_km) return false;
    if (typeof s.maxPower_kW === 'number' && s.maxPower_kW < minPower_kW) return false;
    if (network && (!s.network || !s.network.toLowerCase().includes(network.toLowerCase()))) return false;
    return true;
  });

  const num = (v, fallback) => (typeof v === 'number' ? v : fallback);
  const sortFns = {
    distance: (a, b) => num(a.distance_km, Infinity) - num(b.distance_km, Infinity),
    speed: (a, b) => num(b.maxPower_kW, 0) - num(a.maxPower_kW, 0),
    price: (a, b) => num(a.pricePerKWh, Infinity) - num(b.pricePerKWh, Infinity),
    availability: (a, b) => num(b.availablePorts, 0) - num(a.availablePorts, 0),
  };

  return filtered.sort(sortFns[sortBy] || sortFns.distance);
}

/**
 * Check upcoming calendar events that may require driving.
 */
export async function getCalendarEvents(input = {}) {
  const { date, rangeStart, rangeEnd, keyword } = calendarQuerySchema.parse(input);
  const events = calendarData;

  return events.filter((event) => {
    const start = new Date(event.start).getTime();
    const matchesDate = date ? event.start.startsWith(date) : true;
    const matchesRange = rangeStart && rangeEnd
      ? start >= new Date(rangeStart).getTime() && start <= new Date(rangeEnd).getTime()
      : true;
    const matchesKeyword = keyword
      ? JSON.stringify(event).toLowerCase().includes(keyword.toLowerCase())
      : true;
    return matchesDate && matchesRange && matchesKeyword;
  });
}

/**
 * Get unfinished charging tasks from previous sessions.
 */
export async function getPendingChargeTasks() {
  const data = await readPending();
  return data.tasks.filter((t) => t.status === 'pending');
}

/**
 * Turn a known route/event distance into a deterministic energy decision.
 * The LLM may choose when to use this tool, but it may not invent the distance:
 * it should come from navigation, calendar data, or an explicit user value.
 */
export async function assessTripEnergy(input) {
  const { distance_km, roundTrip, reserveRange_km } = tripEnergySchema.parse(input);
  const tripDistance_km = Number((distance_km * (roundTrip ? 2 : 1)).toFixed(1));
  const requiredRange_km = Number((tripDistance_km + reserveRange_km).toFixed(1));
  const availableRange_km = vehicleState.estimatedRange_km;
  const shortage_km = Number(Math.max(0, requiredRange_km - availableRange_km).toFixed(1));
  const rangePerSocPoint = availableRange_km / vehicleState.soc;
  const minimumDepartureSoc = Math.min(100, Math.ceil(requiredRange_km / rangePerSocPoint));

  return {
    sufficient: shortage_km === 0,
    distance_km,
    roundTrip,
    tripDistance_km,
    reserveRange_km,
    requiredRange_km,
    availableRange_km,
    shortage_km,
    currentSoc: vehicleState.soc,
    minimumDepartureSoc,
  };
}

/**
 * Create a charging plan: pick a station, set target SOC, persist as pending task.
 */
export async function createChargePlan(input) {
  const parsed = chargePlanSchema.parse(input);
  const station = stationsData.find((s) => s.id === parsed.stationId);

  if (!station) throw new Error(`Station ${parsed.stationId} not found.`);

  const task = {
    id: `task-${Date.now()}`,
    type: 'charge_recommendation',
    status: 'pending',
    createdAt: new Date().toISOString(),
    reason: parsed.reason,
    recommendedStation: {
      id: station.id,
      name: station.name,
      distance_km: station.distance_km,
      maxPower_kW: station.maxPower_kW,
      estimatedChargeTime_min: station.estimatedChargeTime_min,
    },
    targetSoc: parsed.targetSoc,
    urgent: parsed.urgent,
    userAction: null,
    retryOnNextStart: true,
  };

  const data = await readPending();
  data.tasks.push(task);
  data.lastUpdated = new Date().toISOString();
  await writePending(data);

  return task;
}

/**
 * Anthropic-compatible tool definitions for the cockpit charging agent.
 */
export const anthropicTools = [
  {
    name: 'get_vehicle_status',
    description: 'Get the current vehicle state: battery SOC, estimated range, current location, and active navigation info.',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'search_nearby_stations',
    description: 'Search for nearby EV charging stations. Supports filtering by max distance, minimum charging power, network preference, and sorting by distance/speed/price/availability.',
    input_schema: {
      type: 'object',
      properties: {
        maxDistance_km: { type: 'number', description: 'Maximum search radius in km. Default 10.' },
        minPower_kW: { type: 'number', description: 'Minimum charging power in kW. Default 0.' },
        network: { type: 'string', description: 'Filter by charging network name (e.g. "Tesla", "NIO").' },
        sortBy: { type: 'string', enum: ['distance', 'speed', 'price', 'availability'], description: 'Sort results by this criterion. Default "distance".' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_calendar_events',
    description: 'Check the user calendar for upcoming events that may require driving. Each event includes destination location and distance. Use this to assess whether current battery can support upcoming trips.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Specific day in YYYY-MM-DD format.' },
        rangeStart: { type: 'string', description: 'Range start in ISO-8601 format.' },
        rangeEnd: { type: 'string', description: 'Range end in ISO-8601 format.' },
        keyword: { type: 'string', description: 'Optional keyword filter.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_pending_charge_tasks',
    description: 'Retrieve unfinished charging tasks from previous sessions. These are recommendations the user dismissed or did not act on. The agent should re-evaluate and remind the user if still relevant.',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'assess_trip_energy',
    description: 'Deterministically assess whether current battery range can cover a known trip distance plus a safety reserve. Only use a distance returned by navigation/calendar data or explicitly supplied by the user; never guess a route distance.',
    input_schema: {
      type: 'object',
      properties: {
        distance_km: { type: 'number', description: 'Known one-way route distance in km.' },
        roundTrip: { type: 'boolean', description: 'Whether to assess a round trip. Default true.' },
        reserveRange_km: { type: 'number', description: 'Safety reserve in km. Default 20.' },
      },
      required: ['distance_km'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_charge_plan',
    description: 'Create a charging plan by selecting a station and target SOC. This persists as a pending task the user can execute or defer.',
    input_schema: {
      type: 'object',
      properties: {
        stationId: { type: 'string', description: 'ID of the recommended charging station.' },
        targetSoc: { type: 'number', description: 'Target battery percentage after charging. Default 80.' },
        reason: { type: 'string', description: 'Why this charge is recommended.' },
        urgent: { type: 'boolean', description: 'Whether this is an urgent charge needed for an imminent trip.' },
      },
      required: ['stationId'],
      additionalProperties: false,
    },
  },
];

/**
 * Single dispatch entry for tool execution.
 */
export async function executeTool(name, input, context = {}) {
  switch (name) {
    case 'get_vehicle_status':
      return getVehicleStatus();
    case 'search_nearby_stations':
      return searchNearbyStations(input);
    case 'get_calendar_events':
      return getCalendarEvents(input);
    case 'get_pending_charge_tasks':
      return getPendingChargeTasks();
    case 'assess_trip_energy':
      if (Array.isArray(context.trustedTripDistances)) {
        const requestedDistance = Number(input?.distance_km);
        const trusted = context.trustedTripDistances.some((distance) => Math.abs(distance - requestedDistance) < 0.01);
        if (!trusted) {
          throw new Error('No trusted destination distance is available. Ask the driver for the one-way distance; do not use a charging-station distance.');
        }
      }
      return assessTripEnergy(input);
    case 'create_charge_plan':
      if (context.allowWrite === false) {
        return {
          status: 'awaiting_confirmation',
          approvalRequired: true,
          proposedPlan: chargePlanSchema.parse(input),
          message: 'The plan is ready but has not been persisted. Ask the driver to confirm with Yes/No.',
        };
      }
      return createChargePlan(input);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
