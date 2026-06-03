// Local dev runs the API on :3001; in production the API is same-origin (/api),
// served by Vercel serverless functions alongside the static frontend.
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof location !== 'undefined' && location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : '/api');

async function request(path, options = {}) {
  // Abort very slow requests so the UI fails clearly instead of hanging.
  // The agent's first call can be slow on a serverless cold start, so allow 90s.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 90_000);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('请求超时,服务可能正在冷启动,请重试。 / Request timed out (cold start) — please retry.');
    }
    throw new Error('网络请求失败,请检查网络后重试。 / Network error — please retry.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(payload.error || `Request failed (${response.status})`);
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
