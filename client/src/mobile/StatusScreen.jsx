import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { BRAND } from './ui';

/**
 * Vehicle hero screen — ported from the Figma "充电状态页":
 * dark gradient, big model name, glowing SOC ring, range + trip stats.
 */
export default function StatusScreen({ onAskAgent }) {
  const [vehicle, setVehicle] = useState(null);

  useEffect(() => {
    api.getVehicleStatus().then(setVehicle).catch(() => {});
  }, []);

  const soc = vehicle?.soc ?? 0;
  const range = vehicle?.estimatedRange_km ?? 0;
  const low = soc <= 30;
  const ringColor = low ? '#f87171' : '#22d3ee';

  // SVG ring geometry
  const R = 78;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 px-6 pb-6 pt-2 text-white">
      <div className="flex items-center justify-between">
        <button onClick={onAskAgent} className="text-2xl text-white/80">‹</button>
        <span className="text-xl text-white/60">⋯</span>
      </div>

      <h1 className="mt-2 text-center text-5xl font-black tracking-tight text-cyan-300 drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]">
        {vehicle?.model || 'EV'}
      </h1>

      {/* Glowing SOC ring */}
      <div className="relative mx-auto mt-8 h-56 w-56">
        <div
          className="absolute inset-6 rounded-full blur-2xl"
          style={{ background: low ? 'rgba(248,113,113,0.35)' : 'rgba(34,211,238,0.35)' }}
        />
        <svg viewBox="0 0 180 180" className="relative h-full w-full -rotate-90">
          <circle cx="90" cy="90" r={R} stroke="rgba(255,255,255,0.10)" strokeWidth="10" fill="none" />
          <circle
            cx="90" cy="90" r={R}
            stroke={ringColor} strokeWidth="10" fill="none" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - soc / 100)}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-6xl font-black">{soc}<span className="text-2xl align-top">%</span></div>
          <div className="text-sm text-white/60">续航约 {range} km</div>
        </div>
      </div>

      {/* SOC summary pill */}
      <div className="mt-8 flex items-center overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
        <div className={`flex items-center gap-2 bg-gradient-to-br ${BRAND} px-5 py-4 text-slate-900`}>
          <span className="text-lg">⚡</span>
          <span className="text-2xl font-bold">{soc}%</span>
        </div>
        <div className="px-4 text-sm text-white/80">
          {low ? '电量偏低，建议尽快补能' : '电量充足'}
          <div className="text-xs text-white/50">剩余续航 {range} km</div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="总里程" value={`${range} Km`} sub="Available" />
        <Stat
          label="当前导航"
          value={vehicle?.navigation?.active ? '进行中' : '未设置'}
          sub={vehicle?.navigation?.destination_address || vehicle?.currentLocation?.address?.split(',')[0] || '—'}
        />
      </div>

      <button
        onClick={onAskAgent}
        className={`mt-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br ${BRAND} py-4 text-base font-semibold text-slate-900 shadow-lg shadow-cyan-500/20`}
      >
        ⚡ 问 ChargeFlow：现在该充电吗？
      </button>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-lg font-bold text-cyan-300">{value}</div>
      <div className="truncate text-[11px] text-white/40">{sub}</div>
    </div>
  );
}
