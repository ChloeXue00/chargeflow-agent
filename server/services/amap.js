/**
 * Amap (高德) Web Service client — real charging-station data.
 *
 * Uses POI "around" search (v5) to find real charging stations near a
 * coordinate. Enabled when AMAP_WEB_KEY is set; otherwise the caller falls
 * back to bundled mock data (same philosophy as the Claude mock mode), so the
 * demo keeps working with zero config.
 *
 * Note: basic POI search returns name / location / address / distance, but not
 * real-time port availability, power, or price (those require an operator
 * partnership). Those fields are left undefined and degrade gracefully in the UI.
 */

const AMAP_KEY = process.env.AMAP_WEB_KEY;
const AROUND_URL = 'https://restapi.amap.com/v5/place/around';
// Amap POI category code for 充电站 (charging stations).
const CHARGING_TYPE = '011100';

export function amapEnabled() {
  return Boolean(AMAP_KEY);
}

/**
 * Map one Amap POI into the station shape the agent + UI already understand.
 */
export function mapPoiToStation(poi) {
  const [lng, lat] = String(poi.location || '').split(',').map(Number);
  const distanceMeters = Number(poi.distance);
  // Amap "快充/慢充" style hints sometimes live in business fields; best-effort.
  const powerHint = poi.business || poi.type || '';
  const isFast = /快充|超充|fast/i.test(powerHint);

  return {
    id: poi.id,
    name: poi.name,
    address: poi.address || poi.pname ? `${poi.pname || ''}${poi.cityname || ''}${poi.adname || ''}${poi.address || ''}` : undefined,
    location: Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : undefined,
    distance_km: Number.isFinite(distanceMeters) ? Math.round(distanceMeters / 100) / 10 : undefined,
    network: poi.brand || undefined,
    maxPower_kW: isFast ? 120 : undefined, // unknown from basic POI; hint only
    source: 'amap',
  };
}

/**
 * Search real charging stations around a coordinate.
 * @returns {Promise<Array>} mapped stations, sorted by distance. Throws on API error.
 */
export async function searchChargingStations({ lng, lat, radius_m = 5000, keywords = '充电站', limit = 10 } = {}) {
  if (!AMAP_KEY) throw new Error('AMAP_WEB_KEY not configured');
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error('Invalid center coordinate');

  const params = new URLSearchParams({
    key: AMAP_KEY,
    location: `${lng},${lat}`,
    keywords,
    types: CHARGING_TYPE,
    radius: String(radius_m),
    sortrule: 'distance',
    page_size: String(Math.min(limit, 25)),
    page_num: '1',
    show_fields: 'business',
  });

  const res = await fetch(`${AROUND_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Amap HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== '1') throw new Error(`Amap error: ${data.info || 'unknown'} (${data.infocode})`);

  return (data.pois || []).map(mapPoiToStation).filter((s) => s.name);
}
