import Anthropic from '@anthropic-ai/sdk';
import { anthropicTools, executeTool } from './tools.js';
import { extractMemoryCandidates, formatMemoryForPrompt, getMemorySnapshot, persistMemory } from './memory.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

/**
 * Static, layered system prompt for the intelligent cockpit charging agent.
 * Structure: role -> scenario rules -> tools -> constraints.
 *
 * This text never changes between turns, so it is sent as a cached system block
 * (see runAgentTurn). Per-driver memory is injected as a separate, uncached block
 * so the large static prefix stays a stable prompt-cache hit (~90% input cost cut).
 */
function buildSystemPrompt() {
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
- Use assess_trip_energy after obtaining a known route/event distance; never invent distance inputs.
- Use create_charge_plan to persist a recommendation the user can act on.
- NEVER guess battery levels, station availability, or distances — always use tools.
- Calendar data belongs to the demo snapshot. Do not invent year-wide ranges; omit date ranges when a keyword is enough.

Memory layer:
- Remembered facts about this driver are provided in a separate system block. Use them when making recommendations.

Constraint layer:
- Always state the current SOC and estimated range when discussing charging.
- When recommending a station, explain WHY this station (distance, speed, availability, price, user preference).
- If multiple scenarios apply, address them in priority order (safety first).
- Use Chinese as the primary language, with key technical terms in English where natural.
- If the driver declines a recommendation, acknowledge it and note it as a pending task for next session.
- Present at most two options: one recommended plan and at most one alternative.
- Creating or executing a plan requires the driver's explicit Yes/No confirmation. Before confirmation, explain the recommendation and ask one short question.
- Keep responses concise — drivers should be able to read them at a glance.`;
}

const MAX_AGENT_ROUNDS = 6;
const MAX_TOOL_CALLS = 12;

function hasExplicitApproval(messages) {
  const latest = messages.at(-1)?.content;
  if (typeof latest !== 'string') return false;
  return /(^|[，。,.!\s])(yes|ok|okay|确认|同意|执行|导航过去|开始导航|就这个|按这个来|保留为待办|稍后提醒)([，。,.!\s]|$)/i.test(latest.trim());
}

function getText(response) {
  return (response?.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function buildDecision(toolCalls) {
  const latest = (name) => [...toolCalls].reverse().find((call) => call.name === name)?.result;
  const vehicle = latest('get_vehicle_status');
  const assessment = latest('assess_trip_energy');
  const stationsResult = latest('search_nearby_stations');
  const stations = Array.isArray(stationsResult) ? stationsResult : stationsResult?.stations || [];
  const plan = latest('create_charge_plan');

  if (!vehicle && !assessment && !stations.length && !plan) return null;

  const needsCharge = assessment ? !assessment.sufficient : Number(vehicle?.soc) < 20;
  const options = stations.slice(0, 2).map((station, index) => ({
    id: station.id,
    rank: index + 1,
    label: index === 0 ? '主方案' : '备选方案',
    name: station.name,
    distance_km: station.distance_km,
    maxPower_kW: station.maxPower_kW,
    availablePorts: station.availablePorts,
    estimatedWait_min: station.estimatedWait_min,
    pricePerKWh: station.pricePerKWh,
  }));

  return {
    state: plan?.status || (options.length ? 'recommended' : 'assessed'),
    title: needsCharge ? '建议先补能' : '当前行程可覆盖',
    summary: assessment
      ? `预计需 ${assessment.requiredRange_km}km（含 ${assessment.reserveRange_km}km 安全余量），当前可用 ${assessment.availableRange_km}km。`
      : vehicle
        ? `当前 SOC ${vehicle.soc}%，预计续航 ${vehicle.estimatedRange_km}km。`
        : '已完成补能方案评估。',
    options,
    requiresConfirmation: Boolean(options.length) && plan?.status !== 'pending',
    prompt: options.length ? '是否执行主方案？' : null,
  };
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

  const isTripDecision = /分钟后|小时后|往返|开会|接人|机场|目的地/.test(latest);
  const approvedPlan = /(^|[，。,.!\s])yes([，。,.!\s]|$)|确认主方案|同意|按这个来/i.test(latest);
  const deferredPlan = /(^|[，。,.!\s])no([，。,.!\s]|$)|暂不执行|保留为待办|稍后提醒/i.test(latest);

  if (approvedPlan || deferredPlan) {
    toolCalls.push({
      id: `toolu_${Date.now()}`,
      name: 'create_charge_plan',
      input: { stationId: latest.includes('tesla') ? 'cs-001' : 'cs-002', targetSoc: 80, urgent: false },
      result: { id: `task-${Date.now()}`, status: 'pending', userAction: approvedPlan ? 'confirmed' : 'deferred' },
    });
    reply = approvedPlan
      ? '已确认主方案并创建补能任务。我会在出发前再次检查站点状态；导航或支付仍需你在车机端最终确认。'
      : '已将主方案保留为待办，稍后提醒。站点状态变化时我会重新评估，不会直接执行导航或支付。';
  } else if (isTripDecision && (latest.includes('电量') || latest.includes('够') || latest.includes('续航'))) {
    toolCalls.push({
      id: `toolu_${Date.now()}`,
      name: 'get_vehicle_status',
      input: {},
      result: { soc: 18, estimatedRange_km: 62, navigation: { active: false } },
    });
    toolCalls.push({
      id: `toolu_${Date.now() + 1}`,
      name: 'get_calendar_events',
      input: { keyword: '浦东' },
      result: [{ title: 'Client meeting at Pudong Office', distance_km: 3.5 }],
    });
    toolCalls.push({
      id: `toolu_${Date.now() + 2}`,
      name: 'assess_trip_energy',
      input: { distance_km: 3.5, roundTrip: true, reserveRange_km: 20 },
      result: { sufficient: true, requiredRange_km: 27, availableRange_km: 62, reserveRange_km: 20 },
    });
    toolCalls.push({
      id: `toolu_${Date.now() + 3}`,
      name: 'search_nearby_stations',
      input: { maxDistance_km: 10, sortBy: 'distance' },
      result: [
        { id: 'cs-002', name: 'NIO Power Swap - People\'s Square', distance_km: 0.8, availablePorts: 2, maxPower_kW: 180, estimatedWait_min: 10 },
        { id: 'cs-001', name: 'Tesla Supercharger - Lujiazui Center', distance_km: 3.2, availablePorts: 5, maxPower_kW: 250, estimatedWait_min: 0 },
      ],
    });
    reply = '结论：本次往返预计需要 27km（含 20km 安全余量），当前续航 62km，可以准时完成。考虑 SOC 只有 18%，建议会后执行主方案补能；我只保留一个备选。是否执行主方案？';
  } else if (latest.includes('电量') || latest.includes('battery') || latest.includes('状态') || latest.includes('status')) {
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
/**
 * Builds the system blocks for a turn.
 * - Block 1: the large static prompt, marked with cache_control so Claude
 *   reuses the cached prefix on every turn (90% cheaper input, lower latency).
 * - Block 2: the per-driver memory snapshot, left uncached because it changes.
 */
function buildSystemBlocks(memory) {
  return [
    {
      type: 'text',
      text: buildSystemPrompt(),
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: `Remembered facts about this driver:\n${formatMemoryForPrompt(memory)}`,
    },
  ];
}

export async function runAgentTurn(messages) {
  const memory = await getMemorySnapshot();
  const system = buildSystemBlocks(memory);

  if (!anthropic || process.env.MOCK_MODE === 'true') {
    const mock = createMockResponse(messages, memory);
    const persisted = await persistMemory(extractMemoryCandidates(messages, mock.message));
    return { ...mock, memory: persisted, decision: buildDecision(mock.toolCalls) };
  }

  let response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system,
    tools: anthropicTools,
    messages: toAnthropicMessages(messages),
  });

  const toolCalls = [];
  const loopMessages = [...toAnthropicMessages(messages)];
  const allowWrite = hasExplicitApproval(messages);
  let rounds = 0;

  while (rounds < MAX_AGENT_ROUNDS) {
    const toolBlocks = (response.content || []).filter((block) => block.type === 'tool_use');
    if (!toolBlocks.length) break;
    if (toolCalls.length + toolBlocks.length > MAX_TOOL_CALLS) break;

    loopMessages.push({ role: 'assistant', content: response.content });
    const toolResults = await Promise.all(toolBlocks.map(async (block) => {
      try {
        const result = await executeTool(block.name, block.input, { allowWrite });
        toolCalls.push({ id: block.id, name: block.name, input: block.input, result, round: rounds + 1 });
        return { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) };
      } catch (error) {
        const result = { error: error.message };
        toolCalls.push({ id: block.id, name: block.name, input: block.input, result, round: rounds + 1 });
        return { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result), is_error: true };
      }
    }));
    loopMessages.push({ role: 'user', content: toolResults });
    rounds += 1;

    response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system,
      tools: anthropicTools,
      messages: loopMessages,
    });
  }

  let assistantText = getText(response);
  if (!assistantText) {
    assistantText = toolCalls.length >= MAX_TOOL_CALLS || rounds >= MAX_AGENT_ROUNDS
      ? '我已完成当前可用信息的检查，但达到本轮安全执行上限。请确认是否继续生成补能方案。'
      : '我已经取回数据，但还缺少形成安全决策所需的信息。请补充目的地或单程距离。';
  }

  const persisted = await persistMemory(extractMemoryCandidates(messages, assistantText));

  return {
    message: assistantText,
    toolCalls,
    mode: 'anthropic',
    memory: persisted,
    decision: buildDecision(toolCalls),
  };
}
