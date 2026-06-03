import { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { api } from '../utils/api';

const JS_KEY = import.meta.env.VITE_AMAP_JS_KEY;
const SECURITY = import.meta.env.VITE_AMAP_SECURITY;

/** True when an Amap JS key is configured — parents use this to decide whether to show the map. */
export const AMAP_MAP_ENABLED = Boolean(JS_KEY);

/**
 * Interactive Amap (高德) map: centers on the vehicle and drops markers for
 * nearby charging stations. Renders only when VITE_AMAP_JS_KEY is set; otherwise
 * returns null so the surrounding UI is unchanged (graceful, zero-config demo).
 *
 * Stations are whatever search_nearby_stations returned (real Amap POIs carry
 * { location: { lng, lat } }; mock stations carry it too), so markers work in
 * both modes once a JS key is present.
 */
export default function AmapView({ stations = [], height = 200, className = '' }) {
  const containerRef = useRef(null);
  const [center, setCenter] = useState(null); // [lng, lat]
  const [failed, setFailed] = useState(false);

  // Vehicle location → map center + "current location" marker.
  useEffect(() => {
    let active = true;
    api.getVehicleStatus()
      .then((v) => {
        const loc = v?.currentLocation;
        if (active && loc && Number.isFinite(loc.lng) && Number.isFinite(loc.lat)) {
          setCenter([loc.lng, loc.lat]);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Stable signature so the map isn't torn down on every parent re-render.
  const sig = stations.map((s) => s.id || s.name).join('|');

  useEffect(() => {
    if (!JS_KEY || !containerRef.current || !center) return undefined;

    let map;
    let cancelled = false;
    if (SECURITY) window._AMapSecurityConfig = { securityJsCode: SECURITY };

    AMapLoader.load({ key: JS_KEY, version: '2.0' })
      .then((AMap) => {
        if (cancelled || !containerRef.current) return;
        map = new AMap.Map(containerRef.current, {
          zoom: 13,
          center,
          viewMode: '2D',
          mapStyle: 'amap://styles/dark',
        });

        // Vehicle marker (cyan dot).
        new AMap.Marker({
          position: center,
          map,
          anchor: 'center',
          content: '<div style="width:16px;height:16px;border-radius:50%;background:#22d3ee;box-shadow:0 0 0 4px rgba(34,211,238,0.35)"></div>',
        });

        // Station markers.
        for (const s of stations) {
          const loc = s.location;
          if (!loc || !Number.isFinite(loc.lng) || !Number.isFinite(loc.lat)) continue;
          new AMap.Marker({ position: [loc.lng, loc.lat], map, title: s.name });
        }

        map.setFitView(null, false, [24, 24, 24, 24]);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (map) map.destroy();
    };
  }, [center, sig]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!JS_KEY || failed) return null;

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className={`w-full overflow-hidden rounded-2xl border border-slate-700 ${className}`}
    />
  );
}
