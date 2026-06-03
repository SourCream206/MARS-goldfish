import { formatTime } from "./geo.js";

export class TimelineUI {
  constructor(opts) {
    this.onSeek = opts.onSeek;
    this.onPlayToggle = opts.onPlayToggle;
    this.scrubber = document.getElementById("scrubber");
    this.played = document.getElementById("scrubber-played");
    this.thumb = document.getElementById("scrubber-thumb");
    this.track = document.getElementById("scrubber-track");
    this.hoverTime = document.getElementById("scrubber-hover-time");
    this.chart = document.getElementById("alt-chart");
    this.ctx = this.chart.getContext("2d");
    this.timeCurrent = document.getElementById("time-current");
    this.timeTotal = document.getElementById("time-total");
    this.frameInfo = document.getElementById("frame-info");
    this.playing = false;
    this.durationMs = 0;
    this.rows = [];
    this._bind();
  }

  _bind() {
    this.scrubber.addEventListener("input", () => {
      const t = this.indexToTime(parseInt(this.scrubber.value, 10));
      this.onSeek(t, false);
      this.updateVisual(parseInt(this.scrubber.value, 10));
    });

    this.scrubber.addEventListener("change", () => {
      const t = this.indexToTime(parseInt(this.scrubber.value, 10));
      this.onSeek(t, true);
    });

    this.track.addEventListener("mousemove", (e) => {
      const rect = this.track.getBoundingClientRect();
      const ratio = THREE_Clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const idx = Math.round(ratio * (this.rows.length - 1));
      this.hoverTime.textContent = formatTime(this.rows[idx]?.timeMs ?? 0);
      this.hoverTime.style.left = `${ratio * 100}%`;
      this.hoverTime.classList.remove("hidden");
    });
    this.track.addEventListener("mouseleave", () => {
      this.hoverTime.classList.add("hidden");
    });

    this.chart.addEventListener("click", (e) => this._chartSeek(e));
  }

  setData(rows) {
    this.rows = rows;
    this.durationMs = rows[rows.length - 1].timeMs;
    this.scrubber.max = String(rows.length - 1);
    this.scrubber.value = "0";
    this.timeTotal.textContent = formatTime(this.durationMs);
    this.drawAltitudeChart();
    this.updateVisual(0);
  }

  indexToTime(index) {
    return this.rows[Math.min(index, this.rows.length - 1)]?.timeMs ?? 0;
  }

  timeToIndex(timeMs) {
    let lo = 0;
    let hi = this.rows.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (this.rows[mid].timeMs <= timeMs) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  setPlayState(playing) {
    this.playing = playing;
    document.getElementById("icon-play").classList.toggle("hidden", playing);
    document.getElementById("icon-pause").classList.toggle("hidden", !playing);
  }

  updateVisual(index) {
    const ratio = this.rows.length > 1 ? index / (this.rows.length - 1) : 0;
    this.played.style.width = `${ratio * 100}%`;
    this.thumb.style.left = `${ratio * 100}%`;
    this.timeCurrent.textContent = formatTime(this.rows[index]?.timeMs ?? 0);
    this.frameInfo.textContent = `Frame ${index + 1} / ${this.rows.length}`;
    this.scrubber.value = String(index);
    this.drawPlayhead(ratio);
  }

  drawAltitudeChart() {
    const canvas = this.chart;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;

    const alts = this.rows.map((r) => r.altitudeM);
    const minA = Math.min(...alts);
    const maxA = Math.max(...alts);
    const range = Math.max(maxA - minA, 1);

    this.ctx.clearRect(0, 0, w, h);

    const grad = this.ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(61, 158, 255, 0.45)");
    grad.addColorStop(1, "rgba(61, 158, 255, 0.02)");

    this.ctx.beginPath();
    for (let i = 0; i < this.rows.length; i++) {
      const x = (i / (this.rows.length - 1)) * w;
      const y = h - ((alts[i] - minA) / range) * (h - 8) - 4;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.lineTo(w, h);
    this.ctx.lineTo(0, h);
    this.ctx.closePath();
    this.ctx.fillStyle = grad;
    this.ctx.fill();

    this.ctx.strokeStyle = "rgba(61, 158, 255, 0.9)";
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    for (let i = 0; i < this.rows.length; i++) {
      const x = (i / (this.rows.length - 1)) * w;
      const y = h - ((alts[i] - minA) / range) * (h - 8) - 4;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    this._chartMeta = { w, h, minA, maxA, range };
  }

  drawPlayhead(ratio) {
    if (!this._chartMeta) return;
    this.drawAltitudeChart();
    const { w, h } = this._chartMeta;
    const x = ratio * w;
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, 0);
    this.ctx.lineTo(x, h);
    this.ctx.stroke();
  }

  _chartSeek(e) {
    const rect = this.chart.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (this.rows.length - 1));
    this.onSeek(this.rows[idx].timeMs, true);
    this.updateVisual(idx);
  }
}

function THREE_Clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
