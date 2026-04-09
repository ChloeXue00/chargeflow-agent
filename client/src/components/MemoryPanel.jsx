export default function MemoryPanel({ facts = [] }) {
  const typeColors = {
    preference: 'text-emerald-300',
    habit: 'text-blue-300',
    fact: 'text-amber-300',
  };

  return (
    <aside className="rounded-3xl border border-slate-700 bg-slate-900/75 p-5 shadow-2xl backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Driver Memory</h2>
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200">
          {facts.length} facts
        </span>
      </div>
      <div className="space-y-3">
        {facts.length === 0 ? (
          <p className="text-sm text-slate-400">No durable memory stored yet.</p>
        ) : (
          facts.map((fact) => (
            <div key={fact.id} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
              <div className={`mb-1 text-xs uppercase tracking-[0.2em] ${typeColors[fact.type] || 'text-slate-500'}`}>
                {fact.type}
              </div>
              <div className="text-sm leading-6 text-slate-100">{fact.content}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
