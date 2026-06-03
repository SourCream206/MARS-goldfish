import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { latLngToLocal, localBounds } from "./geo.js";
import { TerrainManager } from "./terrain.js";
import { createRocket, orientRocket, setRocketThrust } from "./rocket.js";

export class FlightScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5e8);
    this.scene.fog = new THREE.Fog(0x9ec8ef, 200, 2500);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 8000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    this.terrain = new TerrainManager(this.scene);
    this.rocket = createRocket();
    this.scene.add(this.rocket);

    this.pathLine = null;
    this.trailLine = null;
    this.launchPad = null;
    this.points = [];
    this.groundAlt = 0;
    this.verticalExag = 8;
    this.origin = { lat: 0, lng: 0 };
    this.bounds = null;
    this.cameraMode = "follow";
    this.followOffset = new THREE.Vector3(-25, 18, 35);

    this.setupLights();
    this.setupSky();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0xb8d8ff, 0x3d5c3a, 0.55);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff5e8, 1.15);
    sun.position.set(120, 200, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 600;
    const s = 180;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    this.scene.add(sun);
    this.sun = sun;
  }

  setupSky() {
    const skyGeo = new THREE.SphereGeometry(4000, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x2563ab) },
        bottomColor: { value: new THREE.Color(0xb8dcff) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPosition = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), 0.6), 0.0)), 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  async loadFlight(rows, terrainMode, verticalExagEnabled) {
    this.clearFlight();

    this.origin = {
      lat: rows.reduce((s, r) => s + r.lat, 0) / rows.length,
      lng: rows.reduce((s, r) => s + r.lng, 0) / rows.length,
    };
    this.groundAlt = Math.min(...rows.map((r) => r.altitudeM));
    this.bounds = localBounds(rows, this.origin, this.groundAlt);
    this.verticalExag = verticalExagEnabled ? this.computeVerticalExag(rows) : 1;

    this.points = rows.map((r) => {
      const { x, z } = latLngToLocal(r.lat, r.lng, this.origin);
      const y = (r.altitudeM - this.groundAlt) * this.verticalExag;
      return new THREE.Vector3(x, y, z);
    });

    const center = { lat: this.origin.lat, lng: this.origin.lng };
    await this.terrain.build(terrainMode, this.bounds, this.origin, center, rows);

    this.buildPath();
    this.buildTrail();
    this.buildLaunchPad();

    const start = this.points[0];
    this.rocket.position.copy(start);
    this.positionRocketAt(0, rows);

    const span = Math.max(this.bounds.width, this.bounds.depth);
    this.camera.position.set(start.x - span * 0.4, start.y + span * 0.35, start.z + span * 0.5);
    this.controls.target.copy(start);
    this.sun.position.set(start.x + 100, 180, start.z + 60);
    this.sun.target.position.copy(start);
    this.scene.add(this.sun.target);
  }

  computeVerticalExag(rows) {
    const alts = rows.map((r) => r.altitudeM - this.groundAlt);
    const range = Math.max(...alts) - Math.min(...alts);
    const horiz = Math.max(this.bounds?.width || 100, 50);
    if (range < 1) return Math.min(50, horiz * 0.15);
    const exag = (horiz * 0.25) / Math.max(range, 0.5);
    return THREE.MathUtils.clamp(exag, 1, 80);
  }

  buildPath() {
    const geo = new THREE.BufferGeometry().setFromPoints(this.points);
    const colors = new Float32Array(this.points.length * 3);
    for (let i = 0; i < this.points.length; i++) {
      const t = i / (this.points.length - 1);
      const c = new THREE.Color().setHSL(0.55 - t * 0.35, 0.9, 0.55);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 });
    this.pathLine = new THREE.Line(geo, mat);
    this.scene.add(this.pathLine);
  }

  buildTrail() {
    const maxTrail = 400;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxTrail * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 0.85,
    });
    this.trailLine = new THREE.Line(geo, mat);
    this.trailLine.frustumCulled = false;
    this.scene.add(this.trailLine);
    this.maxTrailVerts = maxTrail;
  }

  buildLaunchPad() {
    const pad = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2, 2.8, 32),
      new THREE.MeshStandardMaterial({ color: 0xffcc44, emissive: 0x332200, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    pad.add(ring);

    const grid = new THREE.GridHelper(14, 14, 0x6688aa, 0x445566);
    grid.position.y = 0.02;
    pad.add(grid);

    pad.position.copy(this.points[0]);
    pad.position.y = 0;
    this.launchPad = pad;
    this.scene.add(pad);
  }

  clearFlight() {
    if (this.pathLine) {
      this.scene.remove(this.pathLine);
      this.pathLine.geometry.dispose();
      this.pathLine.material.dispose();
      this.pathLine = null;
    }
    if (this.trailLine) {
      this.scene.remove(this.trailLine);
      this.trailLine.geometry.dispose();
      this.trailLine.material.dispose();
      this.trailLine = null;
    }
    if (this.launchPad) {
      this.scene.remove(this.launchPad);
      this.launchPad = null;
    }
    this.terrain.dispose();
    this.points = [];
  }

  setTerrainMode(mode, rows) {
    if (!rows.length) return;
    const center = { lat: this.origin.lat, lng: this.origin.lng };
    return this.terrain.build(mode, this.bounds, this.origin, center, rows);
  }

  setVerticalExag(enabled, rows) {
    this.verticalExag = enabled ? this.computeVerticalExag(rows) : 1;
    this.points = rows.map((r) => {
      const { x, z } = latLngToLocal(r.lat, r.lng, this.origin);
      const y = (r.altitudeM - this.groundAlt) * this.verticalExag;
      return new THREE.Vector3(x, y, z);
    });
    if (this.pathLine) {
      this.scene.remove(this.pathLine);
      this.pathLine.geometry.dispose();
      this.pathLine.material.dispose();
      this.buildPath();
    }
  }

  positionRocketAt(index, rows) {
    const row = rows[index];
    const p = this.points[index];
    this.rocket.position.copy(p);
    orientRocket(this.rocket, row.rollDeg, row.pitchDeg, row.yawDeg);
    const thrust = row.speedKmh > 5 || (index > 0 && p.y > this.points[Math.max(0, index - 1)].y + 0.5);
    setRocketThrust(this.rocket, thrust, row.speedKmh);
    this.updateTrail(index);
  }

  updateTrail(upToIndex) {
    if (!this.trailLine) return;
    const start = Math.max(0, upToIndex - this.maxTrailVerts + 1);
    const count = upToIndex - start + 1;
    const pos = this.trailLine.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const p = this.points[start + i];
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    this.trailLine.geometry.setDrawRange(0, count);
    pos.needsUpdate = true;
  }

  setPathVisible(v) {
    if (this.pathLine) this.pathLine.visible = v;
  }

  setTrailVisible(v) {
    if (this.trailLine) this.trailLine.visible = v;
  }

  updateCamera(index, rows) {
    const p = this.points[index];
    const row = rows[index];
    const mode = this.cameraMode;

    if (mode === "orbit") {
      this.controls.enabled = true;
      return;
    }

    this.controls.enabled = mode === "overview";

    const yaw = THREE.MathUtils.degToRad(row.yawDeg);
    const pitch = THREE.MathUtils.degToRad(row.pitchDeg);

    if (mode === "follow") {
      const offset = this.followOffset.clone();
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const target = p.clone();
      const desired = p.clone().add(offset);
      this.camera.position.lerp(desired, 0.08);
      this.controls.target.lerp(target, 0.12);
    } else if (mode === "chase") {
      const back = new THREE.Vector3(Math.sin(yaw), 0.2, Math.cos(yaw)).multiplyScalar(-22);
      const up = new THREE.Vector3(0, 12 + pitch * 0.15, 0);
      const desired = p.clone().add(back).add(up);
      this.camera.position.lerp(desired, 0.1);
      this.controls.target.lerp(p.clone().add(new THREE.Vector3(0, 4, 0)), 0.15);
    } else if (mode === "overview") {
      const span = Math.max(this.bounds.width, this.bounds.depth);
      const desired = new THREE.Vector3(
        (this.bounds.minX + this.bounds.maxX) / 2,
        span * 0.6 + (this.bounds.maxY - this.bounds.minY),
        (this.bounds.minZ + this.bounds.maxZ) / 2 + span * 0.55
      );
      this.camera.position.lerp(desired, 0.05);
      this.controls.target.lerp(
        new THREE.Vector3(p.x, p.y * 0.3, p.z),
        0.08
      );
    }
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
