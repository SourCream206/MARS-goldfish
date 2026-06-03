const M_PER_DEG_LAT = 111320;

export function latLngToLocal(lat, lng, origin) {
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  const x = (lng - origin.lng) * M_PER_DEG_LAT * cosLat;
  const z = -(lat - origin.lat) * M_PER_DEG_LAT;
  return { x, z };
}

export function localBounds(rows, origin, groundAltM) {
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const r of rows) {
    const { x, z } = latLngToLocal(r.lat, r.lng, origin);
    const y = r.altitudeM - groundAltM;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }

  const padXY = Math.max(80, (maxX - minX + maxZ - minZ) * 0.35);
  const padY = Math.max(30, (maxY - minY) * 0.5 + 20);

  return {
    minX: minX - padXY, maxX: maxX + padXY,
    minZ: minZ - padXY, maxZ: maxZ + padXY,
    minY: minY - padY, maxY: maxY + padY,
    width: maxX - minX + 2 * padXY,
    depth: maxZ - minZ + 2 * padXY,
  };
}

export function formatTime(ms) {
  const s = Math.max(0, ms / 1000);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function formatCoord(lat, lng) {
  return `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;
}
