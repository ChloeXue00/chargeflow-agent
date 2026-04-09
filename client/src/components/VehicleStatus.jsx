import { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function VehicleStatus() {
  const [vehicle, setVehicle] = useState(null);

  useEffect(() => {
    api.getVehicleStatus().then(setVehicle).catch(() => {});
  }, []);

  if (!vehicle) return null;

  const socColor = vehicle.soc <= 20
    ? 'text-red-400'
    : vehicle.soc <= 50
      ? 'text-yellow-400'
      : 'text-emerald-400';

  const socBarColor = vehicle.soc <= 20
    ? 'bg-red-500'
    : vehicle.soc <= 50
      ? 'bg-yellow-500'
      : 'bg-emerald-500';

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/75 p-4 backdrop-blur">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Battery SOC</div>
        <div className={`text-2xl font-bold ${socColor}`}>{vehicle.soc}%</div>
        <div className="mt-2 h-2 rounded-full bg-slate-700">
          <div className={`h-2 rounded-full ${socBarColor} transition-all`} style={{ width: `${vehicle.soc}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/75 p-4 backdrop-blur">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Est. Range</div>
        <div className="text-2xl font-bold text-white">{vehicle.estimatedRange_km} <span className="text-sm text-slate-400">km</span></div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/75 p-4 backdrop-blur">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Navigation</div>
        <div className="text-sm font-medium text-white">
          {vehicle.navigation?.active
            ? vehicle.navigation.destination_address || 'Active'
            : <span className="text-slate-500">No destination</span>
          }
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/75 p-4 backdrop-blur">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Location</div>
        <div className="text-sm font-medium text-white truncate">{vehicle.currentLocation?.address || 'Unknown'}</div>
      </div>
    </div>
  );
}
