const COLUMN_ALIASES = {
  time_ms: ["time_ms", "time", "timestamp", "t", "ms"],
  lat: ["lat", "latitude", "latitude_deg"],
  lng: ["lng", "lon", "longitude", "longitude_deg", "long"],
  altitude_m: ["altitude_m", "alt", "altitude", "alt_m", "height"],
  speed_kmh: ["speed_kmh", "speed", "velocity", "groundspeed"],
  course_deg: ["course_deg", "course", "heading", "bearing"],
  roll_deg: ["roll_deg", "roll"],
  pitch_deg: ["pitch_deg", "pitch"],
  yaw_deg: ["yaw_deg", "yaw", "heading_deg"],
  satellites: ["satellites", "sats", "sat_count"],
  hdop: ["hdop", "hdop_m"],
};

function normalizeHeader(h) {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function mapColumns(headers) {
  const normalized = headers.map(normalizeHeader);
  const mapping = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) mapping[key] = idx;
  }
  if (mapping.lat === undefined || mapping.lng === undefined) {
    throw new Error("CSV must include latitude and longitude columns.");
  }
  return mapping;
}

function parseFloatSafe(v) {
  const n = parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : 0;
}

export function parseFlightCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row.");

  const headers = lines[0].split(",").map((h) => h.trim());
  const col = mapColumns(headers);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 3) continue;

    const timeRaw = col.time_ms !== undefined ? parseFloatSafe(parts[col.time_ms]) : i;
    const lat = parseFloatSafe(parts[col.lat]);
    const lng = parseFloatSafe(parts[col.lng]);
    if (!lat && !lng) continue;

    rows.push({
      timeMs: timeRaw,
      lat,
      lng,
      altitudeM: col.altitude_m !== undefined ? parseFloatSafe(parts[col.altitude_m]) : 0,
      speedKmh: col.speed_kmh !== undefined ? parseFloatSafe(parts[col.speed_kmh]) : 0,
      courseDeg: col.course_deg !== undefined ? parseFloatSafe(parts[col.course_deg]) : 0,
      rollDeg: col.roll_deg !== undefined ? parseFloatSafe(parts[col.roll_deg]) : 0,
      pitchDeg: col.pitch_deg !== undefined ? parseFloatSafe(parts[col.pitch_deg]) : 0,
      yawDeg: col.yaw_deg !== undefined ? parseFloatSafe(parts[col.yaw_deg]) : 0,
      satellites: col.satellites !== undefined ? parseFloatSafe(parts[col.satellites]) : 0,
      hdop: col.hdop !== undefined ? parseFloatSafe(parts[col.hdop]) : 0,
    });
  }

  if (rows.length === 0) throw new Error("No valid rows found in CSV.");

  // Normalize time to start at 0
  const t0 = rows[0].timeMs;
  for (const r of rows) r.timeMs -= t0;

  return { rows, columns: Object.keys(col) };
}

export function computeFlightStats(rows) {
  const alts = rows.map((r) => r.altitudeM);
  const speeds = rows.map((r) => r.speedKmh);
  const durationMs = rows[rows.length - 1].timeMs - rows[0].timeMs;

  let maxAlt = alts[0];
  let minAlt = alts[0];
  let maxSpeed = speeds[0];
  let distM = 0;

  for (let i = 1; i < rows.length; i++) {
    maxAlt = Math.max(maxAlt, alts[i]);
    minAlt = Math.min(minAlt, alts[i]);
    maxSpeed = Math.max(maxSpeed, speeds[i]);
    distM += haversineM(rows[i - 1].lat, rows[i - 1].lng, rows[i].lat, rows[i].lng);
  }

  const center = {
    lat: rows.reduce((s, r) => s + r.lat, 0) / rows.length,
    lng: rows.reduce((s, r) => s + r.lng, 0) / rows.length,
  };

  return {
    pointCount: rows.length,
    durationMs,
    maxAltM: maxAlt,
    minAltM: minAlt,
    altRangeM: maxAlt - minAlt,
    maxSpeedKmh: maxSpeed,
    distanceM: distM,
    center,
  };
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
