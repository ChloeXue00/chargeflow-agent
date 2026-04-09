import { useState } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({ messages, loading, error, onSend, onReset }) {
  const [input, setInput] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const value = input.trim();
    if (!value || loading) return;
    setInput('');
    await onSend(value);
  }

  return (
    <section className="flex h-full flex-col rounded-3xl border border-slate-700 bg-slate-900/75 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-white">ChargeFlow Agent</h1>
          <p className="text-sm text-slate-400">Intelligent EV charging assistant with route & schedule awareness</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Reset
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {loading && <div className="text-sm text-slate-400">ChargeFlow Agent is analyzing your energy state...</div>}
        {error && <div className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</div>}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-700 p-4">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Try: 帮我看看电量够不够用 / 附近有什么充电站？/ 后天要去机场接人电量够吗？"
            className="min-h-24 flex-1 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
