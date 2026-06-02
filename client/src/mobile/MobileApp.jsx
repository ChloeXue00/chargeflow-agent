import { useState } from 'react';
import { useChat } from '../hooks/useChat';
import { StatusBar, TabBar } from './ui';
import StatusScreen from './StatusScreen';
import AgentScreen from './AgentScreen';
import MeScreen from './MeScreen';

/**
 * ChargeFlow mobile mini-app (route: /m).
 *
 * One agent brain (shared Express + Claude backend), two surfaces:
 * this phone app is the consumer / beta-acquisition surface; the cockpit
 * at "/" is the in-car embedded form. Both reuse useChat + /api.
 *
 * On a phone it fills the viewport; on desktop it renders inside a device
 * frame so reviewers see it as a phone.
 */
export default function MobileApp() {
  const [tab, setTab] = useState('charge');
  const chat = useChat();
  const darkHeader = tab === 'status';

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 sm:py-8">
      <div className="relative flex h-screen w-full max-w-[430px] flex-col overflow-hidden bg-white sm:h-[900px] sm:rounded-[2.5rem] sm:ring-8 sm:ring-slate-800 sm:shadow-2xl">
        <div className={darkHeader ? 'bg-slate-800' : 'bg-white'}>
          <StatusBar dark={darkHeader} />
        </div>

        <main className="flex-1 overflow-y-auto">
          {tab === 'status' && <StatusScreen onAskAgent={() => setTab('charge')} />}
          {tab === 'charge' && (
            <AgentScreen
              messages={chat.messages}
              toolCalls={chat.toolCalls}
              loading={chat.loading}
              error={chat.error}
              onSend={chat.sendMessage}
              onReset={chat.resetChat}
            />
          )}
          {tab === 'me' && <MeScreen facts={chat.rememberedFacts} />}
        </main>

        <TabBar tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}
