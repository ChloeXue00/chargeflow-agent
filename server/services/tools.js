import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');

const vehiclePath = path.join(dataDir, 'vehicle_state.json');
const stationsPath = path.join(dataDir, 'charging_stations.json');
const calendarPath = path.join(dataDir, 'calendar.json');
const pendingTasksPath = path.join(dataDir, 'pending_tasks.json');

// --- Schemas ---

const vehicleStatusSchema = z.object({}).optional();

const searchStationsSchema = z.object({
  maxDistance_km: z.number().optional().default(10),
  minPower_kW: z.number().optional().default(0),
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

const pendingTasksSchema = z.object({}).optional();

// --- Helpers ---

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Tool Implementations ---

/**
 * Get current vehicle status: SOC, range, location, navigation state.
 */
export async function getVehicleStatus() {
  return readJson(vehiclePath);
}

/**
 * Search nearby charging stations with optional filters.
 */
export async function searchNearbyStations(input = {}) {
  const { maxDistance_km, minPower_kW, network, sortBy } = searchStationsSchema.parse(input);
  const stations = await readJson(stationsPath);

  const filtered = stations.filter((s) => {
    if (s.distance_km > maxDistance_km) return false;
    if (s.maxPower_kW < minPower_kW) return false;
    if (network && !s.network.toLowerCase().includes(network.toLowerCase())) return false;
    return true;
  });

  const sortFns = {
    distance: (a, b) => a.distance_km - b.distance_km,
    speed: (a, b) => b.maxPower_kW - a.maxPower_kW,
    price: (a, b) => a.pricePerKWh - b.pricePerKWh,
    availability: (a, b) => b.availablePorts - a.availablePorts,
  };

  return filtered.sort(sortFns[sortBy] || sortFns.distance);
}

/**
 * Check upcoming calendar events that may require driving.
 */
export async function getCalendarEvents(input = {}) {
  const { date, rangeStart, rangeEnd, keyword } = calendarQuerySchema.parse(input);
  const events = await readJson(calendarPath);

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
  const data = await readJson(pendingTasksPath);
  return data.tasks.filter((t) => t.status === 'pending');
}

/**
 * Create a charging plan: pick a station, set target SOC, persist as pending task.
 */
export async function createChargePlan(input) {
  const parsed = chargePlanSchema.parse(input);
  const stations = await readJson(stationsPath);
  const station = stations.find((s) => s.id === parsed.stationId);

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

  const data = await readJson(pendingTasksPath);
  data.tasks.push(task);
  data.lastUpdated = new Date().toISOString();
  await writeJson(pendingTasksPath, data);

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
export async function executeTool(name, input) {
  switch (name) {
    case 'get_vehicle_status':
      return getVehicleStatus();
    case 'search_nearby_stations':
      return searchNearbyStations(input);
    case 'get_calendar_events':
      return getCalendarEvents(input);
    case 'get_pending_charge_tasks':
      return getPendingChargeTasks();
    case 'create_charge_plan':
      return createChargePlan(input);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
