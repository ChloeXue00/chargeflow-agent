import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const memoryPath = path.join(__dirname, '..', 'data', 'memory.json');

async function readMemoryFile() {
  const raw = await fs.readFile(memoryPath, 'utf-8');
  return JSON.parse(raw);
}

async function writeMemoryFile(data) {
  await fs.writeFile(memoryPath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getMemorySnapshot() {
  return readMemoryFile();
}

/**
 * Heuristic memory extraction.
 *
 * In real production this could be replaced by a summarization / memory-ranking
 * model, but for a portfolio project this keeps the system understandable,
 * debuggable, and runnable without external dependencies.
 */
export function extractMemoryCandidates(messages = [], assistantText = '') {
  const candidates = [];
  const combined = [...messages.map((item) => item.content || ''), assistantText].join('\n');

  const rules = [
    /I usually ([^.]+)\./gi,
    /我一般([。.!\n]+)/g,
    /remember that ([^.]+)\./gi,
    /我的偏好是([。.!\n]+)/g,
  ];

  for (const rule of rules) {
    let match;
    while ((match = rule.exec(combined)) !== null) {
      const content = match[1].trim();
      if (content) {
        candidates.push({
          id: `mem-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          type: 'fact',
          content,
          source: 'heuristic-extraction',
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return candidates;
}

/**
 * Persists only deduplicated durable memory items.
 */
export async function persistMemory(candidates = []) {
  if (!candidates.length) return await readMemoryFile();

  const memory = await readMemoryFile();
  const existing = new Set(memory.facts.map((fact) => fact.content.toLowerCase()));

  for (const candidate of candidates) {
    if (!existing.has(candidate.content.toLowerCase())) {
      memory.facts.push(candidate);
    }
  }

  memory.lastUpdated = new Date().toISOString();
  await writeMemoryFile(memory);
  return memory;
}

/**
 * Formats memory into a compact prompt-friendly block.
 */
export function formatMemoryForPrompt(memory) {
  const facts = (memory?.facts || []).slice(-10).map((fact) => `- ${fact.content}`).join('\n');
  return facts || '- No durable memory yet.';
}
