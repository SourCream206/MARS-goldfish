# Rocket Flight Visualizer

Interactive 3D replay of rocket GPS flight logs (Three.js).

## Quick start

You need a local web server (browsers block ES modules and map tiles from `file://`).

```bash
cd flight-viewer
npx --yes serve .
```

Open the URL shown (usually http://localhost:3000), then:

1. Click **Load bundled sample** (loads `../rocket_flight_log.csv`), or  
2. **Load CSV** / drag-and-drop your own log.

## CSV format

Expected columns (names are flexible):

`time_ms, lat, lng, altitude_m, speed_kmh, course_deg, roll_deg, pitch_deg, yaw_deg, satellites, hdop`

## Features

- **3D rocket** with roll/pitch/yaw and thrust glow when moving
- **Procedural terrain** or **OpenStreetMap / OpenTopoMap** ground tiles
- **Vertical exaggeration** for low-altitude logs (your sample is mostly ~194–199 m)
- **YouTube-style timeline** with altitude chart, scrubber, play/pause, speed (0.25×–10×)
- **Telemetry panel** and flight statistics
- **Camera modes**: follow, chase, orbit, overview
- Keyboard: **Space** play/pause, **←/→** step frames

## Map tiles

Satellite/topo modes fetch tiles from OSM servers. Use only for reasonable preview volume; respect [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
