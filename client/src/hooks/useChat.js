import { useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';

const STORAGE_KEY = 'chargeflow-agent-chat';

const starterMessages = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Hi, I am ChargeFlow Agent. Ask about your schedule, create a mock calendar event, or let me remember a preference.',
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
