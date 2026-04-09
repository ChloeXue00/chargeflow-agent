const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(payload.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  sendChat(messages) {
    return request('/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  },
  getMemory() {
    return request('/memory');
  },
  getVehicleStatus() {
    return request('/vehicle/status');
  },
  getStations(params) {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return request(`/stations${qs}`);
  },
  getEvents(params) {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return request(`/calendar/events${qs}`);
  },
  getPendingTasks() {
    return request('/tasks/pending');
  },
};
