import * as THREE from "three";

export function createRocket() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xe8ecf2,
    metalness: 0.35,
    roughness: 0.4,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xff4444,
    metalness: 0.5,
    roughness: 0.35,
    emissive: 0x441111,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: 0x3d9eff,
    metalness: 0.4,
    roughness: 0.45,
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 2.8, 16), bodyMat);
  body.position.y = 1.4;
  body.castShadow = true;
  group.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 16), accentMat);
  nose.position.y = 3.05;
  nose.castShadow = true;
  group.add(nose);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 16), accentMat);
  band.position.y = 0.5;
  group.add(band);

  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.45), finMat);
    fin.position.set(0.42, 0.35, 0);
    fin.rotation.y = (i * Math.PI) / 2;
    fin.castShadow = true;
    group.add(fin);
  }

  const flame = new THREE.PointLight(0xffaa44, 0, 8);
  flame.position.y = -0.2;
  group.add(flame);
  group.userData.flame = flame;

  const exhaust = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.6, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff8844,
      transparent: true,
      opacity: 0,
    })
  );
  exhaust.position.y = -0.3;
  exhaust.rotation.x = Math.PI;
  group.add(exhaust);
  group.userData.exhaust = exhaust;

  group.scale.setScalar(1.2);
  return group;
}

export function orientRocket(rocket, rollDeg, pitchDeg, yawDeg) {
  rocket.rotation.set(0, 0, 0);
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  const roll = THREE.MathUtils.degToRad(rollDeg);
  rocket.rotation.order = "YXZ";
  rocket.rotation.y = yaw;
  rocket.rotation.x = pitch;
  rocket.rotation.z = roll;
}

export function setRocketThrust(rocket, active, speedKmh) {
  const flame = rocket.userData.flame;
  const exhaust = rocket.userData.exhaust;
  const t = active ? Math.min(1, speedKmh / 80 + 0.3) : 0;
  flame.intensity = t * 2.5;
  exhaust.material.opacity = t * 0.7;
  exhaust.scale.setScalar(0.8 + t * 0.6);
}
