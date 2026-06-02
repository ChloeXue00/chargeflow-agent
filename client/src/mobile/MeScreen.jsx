import { BRAND } from './ui';

const MENU = [
  { icon: '👤', label: '账户设置' },
  { icon: '📍', label: '收藏地点' },
  { icon: '🕑', label: '充电历史' },
  { icon: '🧾', label: '账单' },
  { icon: '🔋', label: '电池状态' },
];

/**
 * Profile tab — driver memory (the agent's cross-session continuity) on top,
 * plus the original Figma "我的" menu and a link to the in-car cockpit view.
 */
export default function MeScreen({ facts = [] }) {
  return (
    <div className="min-h-full bg-slate-50 px-5 pb-6 pt-3">
      <div className={`rounded-3xl bg-gradient-to-br ${BRAND} p-5 text-slate-900`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/40 text-2xl">🚗</div>
          <div>
            <div className="text-lg font-bold">Driver</div>
            <div className="text-xs text-slate-800/70">Model Y · 上海 · 黄浦区</div>
          </div>
        </div>
      </div>

      {/* Driver memory */}
      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">驾驶记忆 / Driver Memory</h2>
        <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs text-cyan-700">{facts.length} facts</span>
      </div>
      <div className="mt-2 space-y-2">
        {facts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400">
            还没有长期记忆。试试对 Agent 说「记住：我偏好特斯拉超充」
          </p>
        ) : (
          facts.map((f) => (
            <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-0.5 text-[10px] uppercase tracking-wider text-cyan-500">{f.type}</div>
              <div className="text-sm leading-6 text-slate-700">{f.content}</div>
            </div>
          ))
        )}
      </div>

      {/* Figma menu */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {MENU.map((m, i) => (
          <div
            key={m.label}
            className={`flex items-center gap-3 px-4 py-3.5 ${i < MENU.length - 1 ? 'border-b border-slate-100' : ''}`}
          >
            <span className="text-lg">{m.icon}</span>
            <span className="flex-1 text-sm text-slate-700">{m.label}</span>
            <span className="text-slate-300">›</span>
          </div>
        ))}
      </div>

      <a
        href="/"
        className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white py-3.5 text-sm font-medium text-slate-600"
      >
        🖥️ 切换到车机座舱版（最终嵌入形态）
      </a>
    </div>
  );
}
