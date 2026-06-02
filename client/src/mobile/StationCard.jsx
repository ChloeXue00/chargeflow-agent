import { Tag } from './ui';

/**
 * Charging-station card in the Figma "当前位置附近可用" style.
 * Renders whatever fields a search_nearby_stations tool result provides,
 * degrading gracefully when a field is missing.
 */
export default function StationCard({ station }) {
  const {
    name,
    distance_km,
    availablePorts,
    maxPower_kW,
    operatingHours = '00:00 - 24:00',
    queue,
  } = station;

  const fast = maxPower_kW >= 120;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-800">{name}</h4>
        {typeof distance_km === 'number' && (
          <span className="shrink-0 text-xs font-medium text-cyan-600">{distance_km} km</span>
        )}
      </div>

      <div className="mt-1 text-[11px] text-slate-400">营业时间 {operatingHours}</div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Tag tone={fast ? 'cyan' : 'green'}>{fast ? '快充' : '慢充'}</Tag>
        {typeof maxPower_kW === 'number' && <Tag tone="orange">{maxPower_kW}kW</Tag>}
        <Tag tone="green">换电站</Tag>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <span>
          空闲桩位 <span className="font-semibold text-slate-700">{availablePorts ?? '—'}</span>
        </span>
        <span>
          当前排队 <span className="font-semibold text-slate-700">{queue ?? 0} 人</span>
        </span>
      </div>
    </div>
  );
}
