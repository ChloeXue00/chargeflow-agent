import { useEffect, useMemo, useState } from 'react';
import { track } from '@vercel/analytics';
import { api } from '../utils/api';

const STORAGE_KEY = 'chargeflow-agent-chat';

const starterMessages = [
  {
    id: 'welcome',
    role: 'assistant',
    content: '你好，我是 ChargeFlow Agent，你的智能座舱补能助手。我会根据电量、行程和日程，为你主动规划最佳充电方案。试试问我：「现在电量够不够用？」',
  },
];

export function useChat() {
  const [messages, setMessages] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : starterMessages;
  });
  const [toolCalls, setToolCalls] = useState([]);
  const [memory, setMemory] = useState({ facts: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    api.getMemory().then(setMemory).catch(() => {});
  }, []);

  async function sendMessage(text) {
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setLoading(true);
    setError('');

    // Beta engagement signal: how many people actually talk to the agent,
    // and from which surface (mobile mini-app vs in-car cockpit).
    const surface = window.location.pathname.replace(/\/+$/, '') === '/m' ? 'mobile' : 'cockpit';
    track('agent_message', { surface });

    try {
      const response = await api.sendChat(nextMessages);
      let responseToolCalls = response.toolCalls || [];
      let responseMessage = response.message;
      let responseDecision = response.decision || null;

      // Keep the flagship trip demo deterministic when the model stops after
      // energy assessment. Station lookup is read-only; plan creation still
      // remains behind the explicit Yes confirmation in DecisionCard.
      const assessmentCall = [...responseToolCalls].reverse().find((call) => call.name === 'assess_trip_energy');
      const needsStationFallback = assessmentCall?.result?.sufficient === false
        && !responseToolCalls.some((call) => call.name === 'search_nearby_stations');
      if (needsStationFallback) {
        try {
          const stationsResult = await api.getStations({
            maxDistance_km: 10,
            minPower_kW: 100,
            network: 'Tesla',
            sortBy: 'distance',
          });
          const stations = Array.isArray(stationsResult) ? stationsResult : stationsResult.stations || [];
          const available = stations
            .filter((station) => station.availablePorts === undefined || station.availablePorts > 0)
            .slice(0, 2);
          responseToolCalls = [
            ...responseToolCalls,
            {
              id: `toolu_ui_${Date.now()}`,
              name: 'search_nearby_stations',
              input: { maxDistance_km: 10, minPower_kW: 100, network: 'Tesla', sortBy: 'distance' },
              result: stations,
              round: 'read-only fallback',
            },
          ];
          const options = available.map((station, index) => ({
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
          const assessment = assessmentCall.result;
          const [main, backup] = options;
          responseMessage = `结论：本次往返需 ${assessment.requiredRange_km}km（含 ${assessment.reserveRange_km}km 安全余量），当前续航 ${assessment.availableRange_km}km，仍缺 ${assessment.shortage_km}km，建议出发前补能。主方案：${main?.name || '附近可用快充站'}${main ? `（${main.distance_km}km、${main.maxPower_kW}kW、${main.availablePorts}个空位）` : ''}${backup ? `；备选：${backup.name}（${backup.distance_km}km、${backup.maxPower_kW}kW、${backup.availablePorts}个空位）` : ''}。是否执行主方案？`;
          responseDecision = {
            state: 'recommended',
            title: '建议先补能',
            summary: `预计需 ${assessment.requiredRange_km}km（含 ${assessment.reserveRange_km}km 安全余量），当前可用 ${assessment.availableRange_km}km。`,
            options,
            requiresConfirmation: Boolean(options.length),
            prompt: options.length ? '是否执行主方案？' : null,
          };
        } catch {
          // Preserve the original agent response if the read-only lookup fails.
        }
      }

      const completesExistingJourney = responseToolCalls.some((call) => call.name === 'create_charge_plan');
      setToolCalls((current) => completesExistingJourney ? [...current, ...responseToolCalls] : responseToolCalls);
      setMemory(response.memory || { facts: [] });
      setMessages([
        ...nextMessages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: responseMessage,
          mode: response.mode,
          decision: responseDecision,
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetChat() {
    localStorage.removeItem(STORAGE_KEY);
    setMessages(starterMessages);
    setToolCalls([]);
    setError('');
  }

  return {
    messages,
    toolCalls,
    memory,
    loading,
    error,
    sendMessage,
    resetChat,
    rememberedFacts: useMemo(() => memory.facts || [], [memory]),
  };
}
