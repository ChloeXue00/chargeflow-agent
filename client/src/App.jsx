import ChatWindow from './components/ChatWindow';
import MemoryPanel from './components/MemoryPanel';
import ToolCallDisplay from './components/ToolCallDisplay';
import { useChat } from './hooks/useChat';

/**
 * Portfolio-facing single page UI.
 *
 * The layout intentionally surfaces three things interviewers care about:
 * 1. the chat product experience,
 * 2. the agent's tool orchestration trace,
 * 3. the durable memory state.
 */
export default function App() {
  const { messages, toolCalls, rememberedFacts, loading, error, sendMessage, resetChat } = useChat();

  return (
    <main className="min-h-screen px-6 py-8 text-white lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-h-[80vh] flex-col gap-6">
          <div className="rounded-3xl border border-blue-400/20 bg-blue-500/10 p-6 shadow-2xl backdrop-blur">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="mb-2 text-sm uppercase tracking-[0.28em] text-blue-200">Portfolio Demo</p>
                <h1 className="text-3xl font-bold">ChargeFlow Agent</h1>
              </div>
              <div className="rounded-full border border-blue-300/20 bg-slate-900/60 px-4 py-2 text-sm text-slate-200">
                Intent reasoning · Tool use · Cross-session memory
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-slate-200/80">
              A full-stack AI assistant prototype that demonstrates product thinking, prompt engineering,
              tool orchestration, and lightweight memory persistence for a realistic job portfolio project.
            </p>
          </div>

          <ChatWindow
            messages={messages}
            loading={loading}
            error={error}
            onSend={sendMessage}
            onReset={resetChat}
          />

          <ToolCallDisplay toolCalls={toolCalls} />
        </div>

        <div className="space-y-6">
          <MemoryPanel facts={rememberedFacts} />

          <section className="rounded-3xl border border-slate-700 bg-slate-900/75 p-5 shadow-2xl backdrop-blur">
            <h2 className="mb-4 text-lg font-semibold">Suggested Demo Prompts</h2>
            <ul className="space-y-3 text-sm leading-6 text-slate-300">
              <li>• 帮我看看明天有什么安排</li>
              <li>• 下周三下午 3 点帮我约一个和产品团队的会议</li>
              <li>• 记住：我一般周三下午不开会</li>
              <li>• Search my notes for interview stories</li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
