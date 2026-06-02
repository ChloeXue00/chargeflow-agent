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
      setToolCalls(response.toolCalls || []);
      setMemory(response.memory || { facts: [] });
      setMessages([
        ...nextMessages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.message,
          mode: response.mode,
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
