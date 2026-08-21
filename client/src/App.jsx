import ChatWindow from './components/ChatWindow';
import MemoryPanel from './components/MemoryPanel';
import ToolCallDisplay from './components/ToolCallDisplay';
import DecisionJourney from './components/DecisionJourney';
import VehicleStatus from './components/VehicleStatus';
import AmapView, { AMAP_MAP_ENABLED } from './components/AmapView';
import { useChat } from './hooks/useChat';

const DEMO_PROMPTS = [
  '帮我看看现在电量够不够用',
  '附近有什么充电站？',
  '后天去浦东机场接人，单程45公里、需要往返，电量够吗？',
  '上次的充电建议还在吗？',
  '记住：我偏好特斯拉超充站',
];

/** Pull station arrays out of the latest search_nearby_stations tool result. */
function latestStations(toolCalls = []) {
  const call = [...toolCalls].reverse().find((c) => c.name === 'search_nearby_stations');
  const r = call?.result;
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.stations)) return r.stations;
  return [];
}

/**
 * ChargeFlow Agent cockpit UI.
 *
 * Layout surfaces four things reviewers care about:
 * 1. Vehicle status dashboard (SOC, range, nav state)
 * 2. The conversational charging assistant
 * 3. Tool orchestration trace (multi-step decision chain)
 * 4. Durable memory state (cross-session continuity)
 */
export default function App() {
  const { messages, toolCalls, rememberedFacts, loading, error, sendMessage, resetChat } = useChat();

  return (
    <main className="min-h-screen px-6 py-8 text-white lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-h-[80vh] flex-col gap-6">
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6 shadow-2xl backdrop-blur">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="mb-2 text-sm uppercase tracking-[0.28em] text-emerald-200">Intelligent Cockpit Agent</p>
                <h1 className="text-3xl font-bold">ChargeFlow Agent</h1>
              </div>
              <div className="rounded-full border border-emerald-300/20 bg-slate-900/60 px-4 py-2 text-sm text-slate-200">
                Energy reasoning · Route awareness · Cross-session memory
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-slate-200/80">
              An enterprise-grade EV cockpit assistant that proactively manages charging decisions based on battery state,
              navigation context, upcoming calendar events, and cross-session task continuity.
            </p>
          </div>

          <VehicleStatus />

          {AMAP_MAP_ENABLED && (
            <section className="rounded-3xl border border-slate-700 bg-slate-900/75 p-4 shadow-2xl backdrop-blur">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">附近充电地图 / Nearby Map</h2>
              <AmapView stations={latestStations(toolCalls)} height={260} />
            </section>
          )}

          <ChatWindow
            messages={messages}
            loading={loading}
            error={error}
            onSend={sendMessage}
            onReset={resetChat}
          />

          <DecisionJourney messages={messages} toolCalls={toolCalls} />

          <ToolCallDisplay toolCalls={toolCalls} />
        </div>

        <div className="space-y-6">
          <MemoryPanel facts={rememberedFacts} />

          <section className="rounded-3xl border border-slate-700 bg-slate-900/75 p-5 shadow-2xl backdrop-blur">
            <h2 className="mb-4 text-lg font-semibold">Demo Scenarios</h2>
            <ul className="space-y-3 text-sm leading-6 text-slate-300">
              <li className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2">
                <span className="text-emerald-300 font-medium">A.</span> 电量不足，当前没有目的地 — 自动推荐充电站
              </li>
              <li className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2">
                <span className="text-emerald-300 font-medium">B.</span> 导航途中电量告急 — 判断是否需要中途充电
              </li>
              <li className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2">
                <span className="text-emerald-300 font-medium">C.</span> 后天去机场接人（45km往返）— 展示完整决策链
              </li>
              <li className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2">
                <span className="text-emerald-300 font-medium">D.</span> 上次没充电就下车了 — 重新提醒未完成任务
              </li>
            </ul>
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Try these prompts:</p>
              <ul className="space-y-2 text-sm text-slate-400">
                {DEMO_PROMPTS.map((prompt, index) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      disabled={loading}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${index === 2 ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15' : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60'}`}
                    >
                      <span className="mr-2 text-emerald-300">&#8226;</span>{prompt}
                      {index === 2 && <span className="ml-2 rounded-full bg-cyan-300/15 px-2 py-0.5 text-[10px] text-cyan-200">完整决策演示</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
