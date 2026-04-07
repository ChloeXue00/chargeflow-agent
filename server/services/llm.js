import Anthropic from '@anthropic-ai/sdk';
import { anthropicTools, executeTool } from './tools.js';
import { extractMemoryCandidates, formatMemoryForPrompt, getMemorySnapshot, persistMemory } from './memory.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

/**
 * Prompt layering is one of the main portfolio talking points of this project.
 * The structure intentionally mirrors the prompt-design doc:
 * role -> tools -> memory -> constraints.
 */
function buildSystemPrompt(memoryText) {
  return `You are ChargeFlow Agent, a personal AI assistant built for a portfolio demo.

Role layer:
- Be proactive, clear, and trustworthy.
- Distinguish between information lookup, scheduling, note retrieval, and casual chat.

Tool layer:
- Use tools whenever the user asks about schedules, creating events, or searching notes.
- Prefer tool calls over hallucinating calendar or knowledge-base data.

Memory layer:
- Use these remembered facts when helpful:
${memoryText}

Constraint layer:
- Keep answers concise but useful.
- Explain tool results naturally.
- If a preference conflicts with a scheduling request, mention it politely.
- If information is missing, ask one focused follow-up question.`;
}

function toAnthropicMessages(messages) {
  return messages.map((message) => ({
    role: message.role,
    content: message.role === 'assistant'
      ? [{ type: 'text', text: message.content }]
      : message.content,
  }));
}

/**
 * Mock fallback keeps the demo operational when no Anthropic API key is present.
 */
function createMockResponse(messages, memory) {
  const latest = messages[messages.length - 1]?.content?.toLowerCase?.() || '';
  const toolCalls = [];
  let reply = 'I am running in mock mode right now, but the architecture is wired for Claude tool use.';

  if (latest.includes('明天') || latest.includes('schedule') || latest.includes('安排')) {
    toolCalls.push({
      id: `toolu_${Date.now()}`,
      name: 'get_calendar_events',
      input: { keyword: 'product' },
      result: [{ title: 'Weekly sync with product team', start: '2026-04-08T15:00:00+08:00' }],
    });
    reply = '我查了日历，明天最值得注意的是 15:00 的产品团队周会。';
  } else if (latest.includes('会议') || latest.includes('create')) {
    toolCalls.push({
      id: `toolu_${Date.now()}`,
      name: 'create_calendar_event',
      input: {
        title: 'Meeting with product team',
        start: '2026-04-15T15:00:00+08:00',
        end: '2026-04-15T15:30:00+08:00',
      },
      result: { ok: true },
    });
    reply = '我已经模拟创建了一个会议事件，并保留了后端真实创建接口。';
  } else if (latest.includes('偏好') || latest.includes('remember')) {
    reply = '我会把这条偏好提取进记忆层，供后续排期时参考。';
  } else if (memory.facts.length) {
    reply = `我记得一些长期信息，比如：${memory.facts.slice(-2).map((item) => item.content).join('；')}`;
  }

  return {
    message: reply,
    toolCalls,
    mode: 'mock',
  };
}

/**
 * Core orchestration loop:
 * 1. inject memory into system prompt
 * 2. call Claude
 * 3. execute tool_use blocks if present
 * 4. return final answer + tool trace + updated memory
 */
export async function runAgentTurn(messages) {
  const memory = await getMemorySnapshot();
  const systemPrompt = buildSystemPrompt(formatMemoryForPrompt(memory));

  if (!anthropic || process.env.MOCK_MODE === 'true') {
    const mock = createMockResponse(messages, memory);
    const persisted = await persistMemory(extractMemoryCandidates(messages, mock.message));
    return { ...mock, memory: persisted };
  }

  const initial = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    tools: anthropicTools,
    messages: toAnthropicMessages(messages),
  });

  const toolCalls = [];
  const followUpMessages = [...toAnthropicMessages(messages)];

  for (const block of initial.content) {
    if (block.type === 'tool_use') {
      const result = await executeTool(block.name, block.input);
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input,
        result,
      });

      followUpMessages.push({ role: 'assistant', content: [block] });
      followUpMessages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          },
        ],
      });
    }
  }

  const finalResponse = toolCalls.length
    ? await anthropic.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        tools: anthropicTools,
        messages: followUpMessages,
      })
    : initial;

  const assistantText = finalResponse.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const persisted = await persistMemory(extractMemoryCandidates(messages, assistantText));

  return {
    message: assistantText,
    toolCalls,
    mode: 'anthropic',
    memory: persisted,
  };
}
