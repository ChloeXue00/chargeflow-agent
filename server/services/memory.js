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
 * Heuristic memory extraction for charging-related preferences.
 *
 * Captures patterns like:
 * - "I prefer Tesla chargers" / "我喜欢特斯拉充电"
 * - "I usually charge before long trips" / "我一般长途前会充电"
 * - "remember that I avoid slow chargers" / "记住我不用慢充"
 */
export function extractMemoryCandidates(messages = [], assistantText = '') {
  const candidates = [];
  const combined = [...messages.map((item) => item.content || ''), assistantText].join('\n');

  const rules = [
    /I (?:usually|always|prefer|never|avoid) ([^.]+)\./gi,
    /我(?:一般|通常|喜欢|不|习惯|偏好)([^。.!\n]+)/g,
    /remember that ([^.]+)\./gi,
    /记住[：:]?\s*([^。.!\n]+)/g,
  ];

  for (const rule of rules) {
    let match;
    while ((match = rule.exec(combined)) !== null) {
      const content = match[1].trim();
      if (content && content.length > 4) {
        candidates.push({
          id: `mem-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          type: 'preference',
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
  const facts = (memory?.facts || []).slice(-10).map((fact) => `- [${fact.type}] ${fact.content}`).join('\n');
  return facts || '- No durable memory yet.';
}
