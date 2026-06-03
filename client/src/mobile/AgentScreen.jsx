import { useEffect, useRef, useState } from 'react';
import { BRAND } from './ui';
import StationCard from './StationCard';
import AmapView, { AMAP_MAP_ENABLED } from '../components/AmapView';

const CHIPS = [
  '现在电量够不够用？',
  '附近有什么充电站？',
  '后天去浦东机场，电量够吗？',
  '上次的充电建议还在吗？',
];

/**
 * The agent tab — the product's core differentiator vs. the original
 * "find a charger" mini-app. Chat + live station cards + tool trace,
 * all in the Figma cyan/teal language.
 */
export default function AgentScreen({ messages, toolCalls, loading, error, onSend, onReset }) {
  const [input, setInput] = useState('');
  const [showTrace, setShowTrace] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function submit(text) {
    const value = (text ?? input).trim();
    if (!value || loading) return;
    setInput('');
    onSend(value);
  }

  const stations = extractStations(toolCalls);

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      {/* header */}
      <div className={`bg-gradient-to-br ${BRAND} px-5 pb-4 pt-3 text-slate-900`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">ChargeFlow Agent</h1>
            <p className="text-xs text-slate-800/70">电量 · 行程 · 日程 · 跨会话记忆</p>
          </div>
          <button onClick={onReset} className="rounded-full bg-white/30 px-3 py-1 text-xs font-medium">
            重置
          </button>
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}

        {stations.length > 0 && (
          <div className="space-y-2">
            <div className="px-1 text-[11px] font-medium text-slate-400">附近可用充电站</div>
            {AMAP_MAP_ENABLED && <AmapView stations={stations} height={200} />}
            {stations.map((s, i) => (
              <StationCard key={s.id || i} station={s} />
            ))}
          </div>
        )}

        {toolCalls.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <button
              onClick={() => setShowTrace((v) => !v)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-slate-500"
            >
              <span>🔧 工具调用链 · {toolCalls.map((t) => t.name).join(' → ')}</span>
              <span className="text-slate-400">{showTrace ? '收起' : '展开'}</span>
            </button>
            {showTrace && (
              <div className="space-y-2 border-t border-slate-100 px-3.5 py-3">
                {toolCalls.map((c) => (
                  <div key={c.id} className="rounded-xl bg-slate-50 p-2.5 text-[11px]">
                    <div className="mb-1 font-semibold text-cyan-600">{c.name}</div>
                    <pre className="overflow-auto whitespace-pre-wrap text-slate-500">
                      {JSON.stringify(c.result, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 px-1 text-sm text-slate-400">
            <Dots /> ChargeFlow 正在分析电量与行程…
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-500">{error}</div>
        )}
        <div ref={endRef} />
      </div>

      {/* scenario chips */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => submit(c)}
            disabled={loading}
            className="shrink-0 rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs text-cyan-700 disabled:opacity-50"
          >
            {c}
          </button>
        ))}
      </div>

      {/* input */}
      <div className="flex items-end gap-2 border-t border-slate-200 bg-white px-3 py-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="问问 ChargeFlow…"
          className="max-h-28 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
        <button
          onClick={() => submit()}
          disabled={loading}
          className={`rounded-2xl bg-gradient-to-br ${BRAND} px-4 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50`}
        >
          发送
        </button>
      </div>
    </div>
  );
}

function Bubble({ message }) {
  const isAssistant = message.role === 'assistant';
  if (isAssistant) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-6 text-slate-700 shadow-sm">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-cyan-500">ChargeFlow</div>
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-cyan-500 to-teal-400 px-3.5 py-2.5 text-sm leading-6 text-white shadow-sm">
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

/** Pull station arrays out of search_nearby_stations tool results. */
function extractStations(toolCalls = []) {
  const call = [...toolCalls].reverse().find((c) => c.name === 'search_nearby_stations');
  if (!call) return [];
  const r = call.result;
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.stations)) return r.stations;
  return [];
}
