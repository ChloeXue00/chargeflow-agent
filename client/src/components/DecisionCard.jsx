function fact(value, suffix = '') {
  return value === undefined || value === null ? '—' : `${value}${suffix}`;
}

export default function DecisionCard({ decision, onAction, compact = false }) {
  if (!decision) return null;
  const titleColor = compact ? 'text-slate-800' : 'text-white';
  const bodyColor = compact ? 'text-slate-600' : 'text-slate-200/80';
  const optionBg = compact ? 'border-slate-200 bg-white/70' : 'border-slate-600/60 bg-slate-950/35';
  const optionTitle = compact ? 'text-slate-800' : 'text-white';
  const optionMeta = compact ? 'text-slate-500' : 'text-slate-300';

  return (
    <section className={`mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Agent Decision</div>
          <h3 className={`mt-1 font-semibold ${titleColor}`}>{decision.title}</h3>
        </div>
        <span className="rounded-full bg-slate-950/40 px-2 py-1 text-[10px] text-emerald-100">{decision.state}</span>
      </div>

      <p className={`mt-2 text-xs leading-5 ${bodyColor}`}>{decision.summary}</p>

      {decision.options?.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {decision.options.map((option) => (
            <div key={option.id || option.rank} className={`rounded-xl border p-3 ${optionBg}`}>
              <div className="text-[10px] font-semibold text-emerald-300">{option.label}</div>
              <div className={`mt-1 text-sm font-medium ${optionTitle}`}>{option.name}</div>
              <div className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] ${optionMeta}`}>
                <span>{fact(option.distance_km, 'km')}</span>
                <span>{fact(option.maxPower_kW, 'kW')}</span>
                <span>等待 {fact(option.estimatedWait_min, 'min')}</span>
                <span>空闲 {fact(option.availablePorts)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {decision.requiresConfirmation && onAction && (
        <div className="mt-3">
          <p className={`mb-2 text-xs font-medium ${compact ? 'text-emerald-700' : 'text-emerald-100'}`}>{decision.prompt}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAction(`Yes，确认主方案：${decision.options[0]?.name || ''}`)}
              className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950"
            >
              Yes，确认方案
            </button>
            <button
              type="button"
              onClick={() => onAction('No，暂不执行，保留为待办')}
              className="rounded-full border border-slate-500 px-3 py-1.5 text-xs text-slate-200"
            >
              No，稍后提醒
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
