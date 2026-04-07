import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const calendarPath = path.join(dataDir, 'calendar.json');
const notesPath = path.join(dataDir, 'notes.json');

const calendarQuerySchema = z.object({
  date: z.string().optional(),
  rangeStart: z.string().optional(),
  rangeEnd: z.string().optional(),
  keyword: z.string().optional(),
});

const createEventSchema = z.object({
  title: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  location: z.string().optional().default('TBD'),
  attendees: z.array(z.string()).optional().default([]),
  notes: z.string().optional().default(''),
});

const notesSearchSchema = z.object({
  query: z.string().min(1),
});

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

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

export async function createCalendarEvent(input) {
  const parsed = createEventSchema.parse(input);
  const events = await readJson(calendarPath);

  const newEvent = {
    id: `evt-${Date.now()}`,
    ...parsed,
  };

  events.push(newEvent);
  await writeJson(calendarPath, events);
  return newEvent;
}

export async function searchNotes(input) {
  const { query } = notesSearchSchema.parse(input);
  const notes = await readJson(notesPath);
  const normalized = query.toLowerCase();

  return notes.filter((note) =>
    `${note.title} ${note.content} ${(note.tags || []).join(' ')}`.toLowerCase().includes(normalized)
  );
}

export const anthropicTools = [
  {
    name: 'get_calendar_events',
    description: 'Fetch mock calendar events for a date, range, or keyword.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Specific day in YYYY-MM-DD format.' },
        rangeStart: { type: 'string', description: 'Range start in ISO-8601 format.' },
        rangeEnd: { type: 'string', description: 'Range end in ISO-8601 format.' },
        keyword: { type: 'string', description: 'Optional keyword filter.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'create_calendar_event',
    description: 'Create a mock calendar event with realistic meeting metadata.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'ISO-8601 datetime' },
        end: { type: 'string', description: 'ISO-8601 datetime' },
        location: { type: 'string' },
        attendees: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' }
      },
      required: ['title', 'start', 'end'],
      additionalProperties: false
    }
  },
  {
    name: 'search_notes',
    description: 'Search the mock personal knowledge base or notes store.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query'],
      additionalProperties: false
    }
  }
];

export async function executeTool(name, input) {
  switch (name) {
    case 'get_calendar_events':
      return getCalendarEvents(input);
    case 'create_calendar_event':
      return createCalendarEvent(input);
    case 'search_notes':
      return searchNotes(input);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
