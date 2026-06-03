import * as THREE from "three";
import { latLngToLocal } from "./geo.js";

const TILE_SIZE = 256;

function lon2tileX(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tileY(lat, zoom) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

function tileToLon(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}

function tileToLat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export class TerrainManager {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.mapGroup = null;
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
    if (this.mapGroup) {
      this.scene.remove(this.mapGroup);
      this.mapGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      this.mapGroup = null;
    }
  }

  async build(mode, bounds, origin, centerLatLng, rows) {
    this.dispose();
    const segments = 128;
    const w = bounds.maxX - bounds.minX;
    const d = bounds.maxZ - bounds.minZ;
    const geo = new THREE.PlaneGeometry(w, d, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx;
      const z = pos.getZ(i) + cz;
      pos.setY(i, this.sampleHeight(x, z, rows, bounds));
    }
    geo.computeVertexNormals();

    if (mode === "procedural") {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x2d4a35,
        roughness: 0.92,
        metalness: 0.02,
        flatShading: false,
      });
      this.applyVertexColors(geo, bounds);
      mat.vertexColors = true;
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.receiveShadow = true;
      this.scene.add(this.mesh);
      return;
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);

    await this.applyMapTexture(mode, mat, centerLatLng, bounds, cx, cz);
  }

  sampleHeight(x, z, rows, bounds) {
    const nx = (x - bounds.minX) / (bounds.maxX - bounds.minX);
    const nz = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ);
    const n1 = Math.sin(nx * 12.7 + nz * 8.3) * 0.4;
    const n2 = Math.sin(nx * 31 + nz * 19) * 0.2;
    const n3 = Math.cos(nx * 5 - nz * 7) * 0.15;
    let h = (n1 + n2 + n3) * 3;

    // Gentle bias toward launch area
    const dx = x;
    const dz = z;
    h += Math.exp(-(dx * dx + dz * dz) / 8000) * 2;
    return h;
  }

  applyVertexColors(geo, bounds) {
    const colors = [];
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + 4) / 8;
      const c = new THREE.Color().setHSL(0.28 - t * 0.08, 0.35 + t * 0.2, 0.22 + t * 0.25);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }

  async applyMapTexture(mode, material, center, bounds, cx, cz) {
    const zoom = this.pickZoom(bounds);
    const urlBase =
      mode === "topo"
        ? "https://tile.opentopomap.org/{z}/{x}/{y}.png"
        : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

    const tx = lon2tileX(center.lng, zoom);
    const ty = lat2tileY(center.lat, zoom);
    const tiles = 3;
    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE * tiles;
    canvas.height = TILE_SIZE * tiles;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1a2838";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const loaders = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = tx + dx;
        const y = ty + dy;
        const url = urlBase.replace("{z}", zoom).replace("{x}", x).replace("{y}", y);
        loaders.push(
          loadImage(url).then((img) => {
            ctx.drawImage(img, (dx + 1) * TILE_SIZE, (dy + 1) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }).catch(() => {})
        );
      }
    }
    await Promise.all(loaders);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    material.map = texture;

    const lonMin = tileToLon(tx - 1, zoom);
    const lonMax = tileToLon(tx + 2, zoom);
    const latMax = tileToLat(ty - 1, zoom);
    const latMin = tileToLat(ty + 2, zoom);

    const sw = latLngToLocal(latMin, lonMin, center);
    const ne = latLngToLocal(latMax, lonMax, center);

    const uScale = 1 / (ne.x - sw.x);
    const vScale = 1 / (ne.z - sw.z);
    const uOff = -sw.x * uScale;
    const vOff = -sw.z * vScale;

    const uv = this.mesh.geometry.attributes.uv;
    const pos = this.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx;
      const z = pos.getZ(i) + cz;
      uv.setXY(i, x * uScale + uOff, z * vScale + vOff);
    }
    uv.needsUpdate = true;
    material.needsUpdate = true;
  }

  pickZoom(bounds) {
    const span = Math.max(bounds.width, bounds.depth);
    if (span > 2000) return 14;
    if (span > 500) return 15;
    if (span > 120) return 16;
    return 17;
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
