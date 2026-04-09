import Anthropic from '@anthropic-ai/sdk';
import { anthropicTools, executeTool } from './tools.js';
import { extractMemoryCandidates, formatMemoryForPrompt, getMemorySnapshot, persistMemory } from './memory.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

/**
 * Layered system prompt for the intelligent cockpit charging agent.
 * Structure: role -> scenario rules -> tools -> memory -> constraints.
 */
function buildSystemPrompt(memoryText) {
  return `You are ChargeFlow Agent, an intelligent EV cockpit assistant that proactively manages charging decisions for the driver.

Role layer:
- You are NOT a simple "find a charger" tool. You are a task-aware energy management agent.
- You reason about the driver's current state, upcoming schedule, and driving needs to make smart charging recommendations.
- Be proactive, concise, and safety-first. Always prioritize ensuring the driver can complete their trips.

Scenario rules (execute in priority order):

Scenario A — No destination, no urgent schedule:
- Trigger: Vehicle starts or SOC falls below threshold (20%), no active navigation, no imminent calendar events.
- Action: Immediately search nearby stations, generate an optimal charging plan based on distance, wait time, available ports, and charging speed.
- Principle: When there are no trip constraints, prioritize immediate charging.

Scenario B — Currently navigating to a destination:
- Trigger: Navigation is active, system detects SOC may not support completing the trip or return journey.
- Action: First check if current battery can safely complete the trip. If yes, do NOT interrupt navigation — just inform the driver of the latest safe charging window and suggest charging near the destination or before returning. If battery is insufficient to reach the destination, immediately reroute to the nearest charging station.
- Principle: Protect the current trip first, but lock down a charging deadline.

Scenario C — No navigation active, but calendar has upcoming events:
- Trigger: No active destination, but calendar contains upcoming appointments requiring driving.
- Action: Calculate whether current SOC supports the full trip chain (drive there + drive back). Compute the "latest charging deadline" based on event start time, travel distance, traffic, and charge time. Recommend charging during the current idle window.
- Principle: Look beyond current SOC — assess whether it threatens future commitments.

Scenario D — Resuming from a previous session:
- Trigger: Vehicle restarts, and there are pending charge tasks from a previous session.
- Action: Retrieve unfinished tasks, re-evaluate current conditions (SOC, time, station availability), and present an updated recommendation. Ask the driver if they want to proceed now.
- Principle: The agent has cross-session memory — it never forgets an unfinished task.

Tool layer:
- Always call get_vehicle_status first to understand current state before making any recommendation.
- Use search_nearby_stations to find optimal charging options.
- Use get_calendar_events to check upcoming trips that affect charging urgency.
- Use get_pending_charge_tasks to check for unfinished recommendations from prior sessions.
- Use create_charge_plan to persist a recommendation the user can act on.
- NEVER guess battery levels, station availability, or distances — always use tools.

Memory layer:
- Use these remembered facts about the driver when making recommendations:
${memoryText}

Constraint layer:
- Always state the current SOC and estimated range when discussing charging.
- When recommending a station, explain WHY this station (distance, speed, availability, price, user preference).
- If multiple scenarios apply, address them in priority order (safety first).
- Use Chinese as the primary language, with key technical terms in English where natural.
- If the driver declines a recommendation, acknowledge it and note it as a pending task for next session.
- Keep responses concise — drivers should be able to read them at a glance.`;
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
  let reply = '我正在 mock 模式下运行，但完整的 Agent 架构已就绪，接入 Claude API 后可体验完整决策能力。';

  if (latest.includes('电量') || latest.includes('battery') || latest.includes('状态') || latest.includes('status')) {
    toolCalls.push({
      id: `toolu_${Date.now()}`,
      name: 'get_vehicle_status',
      input: {},
      result: { soc: 18, estimatedRange_km: 62, navigation: { active: false } },
    });
    reply = '当前电量 18%，预计续航 62km。当前无导航目的地，建议立即前往附近充电站补能。';
  } else if (latest.includes('充电') || latest.includes('charge') || latest.includes('补能')) {
    toolCalls.push({
      id: `toolu_${Date.now()}`,
      name: 'get_vehicle_status',
      input: {},
      result: { soc: 18, estimatedRange_km: 62 },
    });
    toolCalls.push({
      id: `toolu_${Date.now() + 1}`,
      name: 'search_nearby_stations',
      input: { maxDistance_km: 10, sortBy: 'distance' },
      result: [
        { id: 'cs-002', name: 'NIO Power Swap - People\'s Square', distance_km: 0.8, availablePorts: 2, maxPower_kW: 180 },
        { id: 'cs-001', name: 'Tesla Supercharger - Lujiazui Center', distance_km: 3.2, availablePorts: 5, maxPower_kW: 250 },
      ],
    });
    reply = '当前 SOC 18%，续航仅 62km。最近的站点是 NIO Power Swap（0.8km，2 个空闲桩，180kW），推荐立即前往。是否导航过去？';
  } else if (latest.includes('日程') || latest.includes('calendar') || latest.includes('行程') || latest.includes('明天')) {
    toolCalls.push({
      id: `toolu_${Date.now()}`,
      name: 'get_calendar_events',
      input: {},
      result: [
        { title: 'Client meeting at Pudong Office', start: '2026-04-08T14:00:00+08:00', distance_km: 3.5 },
        { title: 'Airport pickup - Mom arriving', start: '2026-04-10T18:00:00+08:00', distance_km: 35.0 },
      ],
    });
    reply = '你今天 14:00 有浦东客户会议（3.5km），后天 18:00 要去浦东机场接人（35km，往返约 70km）。当前续航 62km，今天的会议够用，但机场接机前必须充电。最晚补能时间建议：4月10日 15:00 前完成充电。';
  } else if (latest.includes('上次') || latest.includes('pending') || latest.includes('未完成')) {
    toolCalls.push({
      id: `toolu_${Date.now()}`,
      name: 'get_pending_charge_tasks',
      input: {},
      result: [
        { id: 'task-001', status: 'pending', recommendedStation: { name: 'NIO Power Swap - People\'s Square', distance_km: 0.8 }, reason: 'SOC dropped below 20% threshold' },
      ],
    });
    reply = '上次系统建议你去 NIO Power Swap 充电（0.8km），但你当时跳过了。当前电量仍然偏低（18%），建议现在执行这个补能计划。要导航过去吗？';
  } else if (memory.facts.length) {
    reply = `我记得你的一些偏好：${memory.facts.slice(-2).map((item) => item.content).join('；')}。有什么我可以帮你规划的吗？`;
  }

  return {
    message: reply,
    toolCalls,
    mode: 'mock',
  };
}

/**
 * Core orchestration loop:
 * 1. Inject memory into system prompt
 * 2. Call Claude
 * 3. Execute tool_use blocks if present (supports multi-step tool chains)
 * 4. Return final answer + tool trace + updated memory
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
