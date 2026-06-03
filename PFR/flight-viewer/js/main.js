import * as THREE from "three";
import { parseFlightCSV, computeFlightStats } from "./parser.js";
import { formatTime, formatCoord } from "./geo.js";
import { FlightScene } from "./scene.js";
import { TimelineUI } from "./timeline.js";

const canvas = document.getElementById("canvas");
const scene = new FlightScene(canvas);
const timeline = new TimelineUI({
  onSeek: (timeMs, snap) => seekToTime(timeMs, snap),
  onPlayToggle: () => togglePlay(),
});

let rows = [];
let playbackTimeMs = 0;
let playing = false;
let lastFrame = 0;
let terrainMode = "procedural";

const els = {
  welcome: document.getElementById("welcome"),
  telemetry: document.getElementById("telemetry"),
  timelineBar: document.getElementById("timeline-bar"),
  attribution: document.getElementById("map-attribution"),
  dropOverlay: document.getElementById("drop-overlay"),
};

function initUI() {
  const fileInputs = [
    document.getElementById("file-input"),
    document.getElementById("file-input-welcome"),
  ];
  fileInputs.forEach((inp) =>
    inp.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (f) loadFile(f);
    })
  );

  document.getElementById("btn-sample").addEventListener("click", loadSample);
  document.getElementById("btn-sample-welcome").addEventListener("click", loadSample);
  document.getElementById("btn-play").addEventListener("click", togglePlay);
  document.getElementById("btn-step-back").addEventListener("click", () => stepFrame(-1));
  document.getElementById("btn-step-fwd").addEventListener("click", () => stepFrame(1));

  document.getElementById("terrain-mode").addEventListener("change", async (e) => {
    terrainMode = e.target.value;
    els.attribution.classList.toggle("hidden", terrainMode === "procedural");
    if (rows.length) await scene.setTerrainMode(terrainMode, rows);
  });

  document.getElementById("camera-mode").addEventListener("change", (e) => {
    scene.cameraMode = e.target.value;
  });

  document.getElementById("show-trail").addEventListener("change", (e) => {
    scene.setTrailVisible(e.target.checked);
  });
  document.getElementById("show-path").addEventListener("change", (e) => {
    scene.setPathVisible(e.target.checked);
  });
  document.getElementById("vertical-exag").addEventListener("change", (e) => {
    if (rows.length) {
      scene.setVerticalExag(e.target.checked, rows);
      seekToTime(playbackTimeMs, true);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && rows.length) {
      e.preventDefault();
      togglePlay();
    }
    if (e.code === "ArrowLeft") stepFrame(-10);
    if (e.code === "ArrowRight") stepFrame(10);
  });

  setupDragDrop();
  animate();
}

async function loadFile(file) {
  const text = await file.text();
  await loadCSVText(text);
}

async function loadSample() {
  try {
    const res = await fetch("../rocket_flight_log.csv");
    if (!res.ok) throw new Error("not found");
    await loadCSVText(await res.text());
  } catch {
    alert("Place rocket_flight_log.csv next to flight-viewer/ or upload your file.");
  }
}

async function loadCSVText(text) {
  try {
    const parsed = parseFlightCSV(text);
    rows = parsed.rows;
    const stats = computeFlightStats(rows);

    els.welcome.classList.add("hidden");
    els.telemetry.classList.remove("hidden");
    els.timelineBar.classList.remove("hidden");

    const vertExag = document.getElementById("vertical-exag").checked;
    terrainMode = document.getElementById("terrain-mode").value;
    els.attribution.classList.toggle("hidden", terrainMode === "procedural");

    await scene.loadFlight(rows, terrainMode, vertExag);
    timeline.setData(rows);
    playbackTimeMs = 0;
    playing = false;
    timeline.setPlayState(false);
    updateTelemetry(0);
    renderFlightStats(stats);
    seekToTime(0, true);
  } catch (err) {
    alert(`Failed to parse CSV: ${err.message}`);
  }
}

function renderFlightStats(stats) {
  const el = document.getElementById("flight-stats");
  el.innerHTML = `
    <div><strong>${stats.pointCount}</strong> samples</div>
    <div>Duration <strong>${formatTime(stats.durationMs)}</strong></div>
    <div>Distance <strong>${stats.distanceM.toFixed(1)} m</strong></div>
    <div>Altitude <strong>${stats.minAltM.toFixed(1)} – ${stats.maxAltM.toFixed(1)} m</strong> (Δ ${stats.altRangeM.toFixed(1)} m)</div>
    <div>Max speed <strong>${stats.maxSpeedKmh.toFixed(1)} km/h</strong></div>
  `;
}

function indexAtTime(timeMs) {
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (rows[mid].timeMs <= timeMs) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function seekToTime(timeMs, updateScrubber) {
  playbackTimeMs = THREE.MathUtils.clamp(timeMs, 0, rows[rows.length - 1].timeMs);
  const idx = indexAtTime(playbackTimeMs);
  scene.positionRocketAt(idx, rows);
  scene.updateCamera(idx, rows);
  updateTelemetry(idx);
  if (updateScrubber) timeline.updateVisual(idx);
}

function updateTelemetry(index) {
  const r = rows[index];
  document.getElementById("tel-time").textContent = formatTime(r.timeMs);
  document.getElementById("tel-alt").textContent = `${r.altitudeM.toFixed(1)} m`;
  document.getElementById("tel-speed").textContent = `${r.speedKmh.toFixed(1)} km/h`;
  document.getElementById("tel-course").textContent = `${r.courseDeg.toFixed(1)}°`;
  document.getElementById("tel-roll").textContent = `${r.rollDeg.toFixed(1)}°`;
  document.getElementById("tel-pitch").textContent = `${r.pitchDeg.toFixed(1)}°`;
  document.getElementById("tel-yaw").textContent = `${r.yawDeg.toFixed(1)}°`;
  document.getElementById("tel-gps").textContent = `${r.satellites} sats · HDOP ${r.hdop}`;
  document.getElementById("tel-pos").textContent = formatCoord(r.lat, r.lng);
}

function togglePlay() {
  if (!rows.length) return;
  playing = !playing;
  timeline.setPlayState(playing);
  lastFrame = performance.now();
}

function stepFrame(delta) {
  if (!rows.length) return;
  const idx = Math.min(rows.length - 1, Math.max(0, indexAtTime(playbackTimeMs) + delta));
  seekToTime(rows[idx].timeMs, true);
  playing = false;
  timeline.setPlayState(false);
}

function animate(now = 0) {
  requestAnimationFrame(animate);

  if (playing && rows.length) {
    const speed = parseFloat(document.getElementById("playback-speed").value);
    const dt = now - lastFrame;
    lastFrame = now;
    playbackTimeMs += dt * speed;
    const end = rows[rows.length - 1].timeMs;
    if (playbackTimeMs >= end) {
      playbackTimeMs = end;
      playing = false;
      timeline.setPlayState(false);
    }
    seekToTime(playbackTimeMs, true);
  }

  scene.render();
}

function setupDragDrop() {
  let dragCounter = 0;
  document.body.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragCounter++;
    els.dropOverlay.classList.remove("hidden");
  });
  document.body.addEventListener("dragleave", () => {
    dragCounter--;
    if (dragCounter <= 0) els.dropOverlay.classList.add("hidden");
  });
  document.body.addEventListener("dragover", (e) => e.preventDefault());
  document.body.addEventListener("drop", async (e) => {
    e.preventDefault();
    dragCounter = 0;
    els.dropOverlay.classList.add("hidden");
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith(".csv")) await loadFile(f);
  });
}

initUI();
