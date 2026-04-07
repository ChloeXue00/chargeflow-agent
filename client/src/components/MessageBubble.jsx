export default function MessageBubble({ message }) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-lg ${
          isAssistant
            ? 'bg-slate-800/80 text-slate-100 border border-slate-700'
            : 'bg-blue-500 text-white'
        }`}
      >
        <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-slate-300/70">
          {isAssistant ? 'ChargeFlow Agent' : 'You'}
        </div>
        <div className="whitespace-pre-wrap leading-6">{message.content}</div>
        {message.mode && (
          <div className="mt-2 text-[10px] text-slate-300/60">mode: {message.mode}</div>
        )}
      </div>
    </div>
  );
}
