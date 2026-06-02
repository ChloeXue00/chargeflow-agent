/**
 * Shared mobile UI primitives for the ChargeFlow mini-app (/m).
 * Visual language ported from the original Figma design:
 * cyan/teal brand gradient, iOS-style frame, 3-tab bottom bar.
 */

export const BRAND = 'from-cyan-400 to-teal-300';

/** iOS-style status bar (9:41 + signal / wifi / battery). */
export function StatusBar({ dark = false }) {
  const color = dark ? 'text-white' : 'text-slate-900';
  return (
    <div className={`flex items-center justify-between px-6 pt-3 pb-1 text-sm font-semibold ${color}`}>
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        {/* signal */}
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
          {[2, 6, 10, 14].map((x, i) => (
            <rect key={x} x={x} y={8 - i * 2} width="3" height={4 + i * 2} rx="1" fill="currentColor" />
          ))}
        </svg>
        {/* wifi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M8 10.5a1.3 1.3 0 100-2.6 1.3 1.3 0 000 2.6Z" fill="currentColor" />
          <path d="M3.5 5.5a6.5 6.5 0 019 0M5.5 7.5a3.6 3.6 0 015 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {/* battery */}
        <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
          <rect x="0.5" y="1" width="22" height="11" rx="3" stroke="currentColor" strokeOpacity="0.5" />
          <rect x="2" y="2.5" width="17" height="8" rx="1.5" fill="currentColor" />
          <rect x="24" y="4.5" width="2" height="4" rx="1" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

const TABS = [
  { key: 'status', label: '车况', icon: HomeIcon },
  { key: 'charge', label: '充电', icon: BoltIcon, center: true },
  { key: 'me', label: '我的', icon: UserIcon },
];

export function TabBar({ tab, setTab }) {
  return (
    <nav className="flex items-stretch border-t border-slate-200 bg-white/95 px-2 pb-6 pt-2 backdrop-blur">
      {TABS.map(({ key, label, icon: Icon, center }) => {
        const active = tab === key;
        const TabIcon = Icon;
        return (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <span
              className={
                center
                  ? `flex h-12 w-12 -mt-5 items-center justify-center rounded-2xl bg-gradient-to-br ${BRAND} shadow-lg shadow-cyan-500/30`
                  : 'flex h-7 items-center justify-center'
              }
            >
              <TabIcon className={center ? 'text-white' : active ? 'text-cyan-500' : 'text-slate-400'} active={active} />
            </span>
            <span className={`text-[11px] ${active ? 'text-cyan-600 font-medium' : 'text-slate-400'}`}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function HomeIcon({ className = '' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BoltIcon({ className = '' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" />
    </svg>
  );
}

export function UserIcon({ className = '' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Colored capability pill (快充 / 慢充 / 换电站), matching the Figma tags. */
export function Tag({ children, tone = 'cyan' }) {
  const tones = {
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  };
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${tones[tone] || tones.cyan}`}>
      {children}
    </span>
  );
}
