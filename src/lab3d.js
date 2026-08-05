// Calibre NR.1 — three.js lab. Extrudes the generator's geometry (src/movement-3d.json)
// into a PBR movement. Same source of truth as the SVG caseback; judge, then decide.
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import parts from './movement-3d.json';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b14);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
if ('environmentIntensity' in scene) scene.environmentIntensity = 0.5;

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 1, 800);
camera.position.set(0, 0, 178);

// key light from the upper-left, per the design bible's 315°
const key = new THREE.DirectionalLight(0xfff2e0, 2.4);
key.position.set(-60, 80, 90);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -70;
key.shadow.camera.right = key.shadow.camera.top = 70;
key.shadow.bias = -0.0006;
const rimLight = new THREE.DirectionalLight(0xffe4c0, 0.5);
rimLight.position.set(70, -50, 60);
scene.add(rimLight);
scene.add(key);
scene.add(new THREE.AmbientLight(0x30302a, 0.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const MAT = {
  silver: new THREE.MeshStandardMaterial({ color: 0xcabd96, metalness: 0.82, roughness: 0.44, envMapIntensity: 0.55 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xcdd5dd, metalness: 1, roughness: 0.2, envMapIntensity: 0.85 }),
  black: new THREE.MeshStandardMaterial({ color: 0x30363e, metalness: 1, roughness: 0.08 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 1, roughness: 0.3, envMapIntensity: 0.7 }),
  blued: new THREE.MeshStandardMaterial({ color: 0x2a4fb0, metalness: 0.9, roughness: 0.22, envMapIntensity: 0.9 }),
  ruby: new THREE.MeshPhysicalMaterial({ color: 0xb2122c, metalness: 0.1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 }),
  cavity: new THREE.MeshStandardMaterial({ color: 0x17110a, metalness: 0.3, roughness: 0.9 }),
};

const root = new THREE.Group();
scene.add(root);
// SVG space (y down, 0..100) -> scene space (y up, centred)
const toScene = new THREE.Group();
toScene.scale.set(1, -1, 1);
toScene.position.set(0, 0, 0);
root.add(toScene);
const off = v => v - 50;

const loader = new SVGLoader();
function shapesFromPath(d) {
  const svg = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
  const out = [];
  for (const p of svg.paths) out.push(...SVGLoader.createShapes(p));
  return out;
}
function addExtrude(d, z, depth, mat, { bevel = 0.22 } = {}) {
  const shapes = shapesFromPath(d);
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10,
  });
  geo.translate(-50, -50, z);
  const mesh = new THREE.Mesh(geo, MAT[mat]);
  mesh.castShadow = mesh.receiveShadow = true;
  toScene.add(mesh);
  return mesh;
}
function addCyl(x, y, r, z, h, mat, seg = 48) {
  const geo = new THREE.CylinderGeometry(r, r, h, seg);
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, MAT[mat]);
  mesh.position.set(off(x), off(y), z + h / 2);
  mesh.castShadow = mesh.receiveShadow = true;
  toScene.add(mesh);
  return mesh;
}

// cavity floor + shapes
addCyl(50, 50, 49, -3.4, 0.8, 'cavity', 72);
for (const sh of parts.shapes) addExtrude(sh.d, sh.z, sh.depth, sh.mat);

// wheels: toothed rim via short cylinder + smaller face plate + hub
for (const w of parts.wheels) {
  if (w.spokes) {
    const ring = new THREE.Shape();
    ring.absarc(0, 0, w.r, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, w.r - 1.3, 0, Math.PI * 2, true);
    ring.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(ring, { depth: w.h, bevelEnabled: false, curveSegments: 48 });
    const mesh = new THREE.Mesh(geo, MAT[w.mat]);
    mesh.position.set(off(w.x), off(w.y), w.z);
    mesh.castShadow = mesh.receiveShadow = true;
    toScene.add(mesh);
  } else {
    addCyl(w.x, w.y, w.r, w.z, w.h, w.mat);
    addCyl(w.x, w.y, w.r * 0.94, w.z + w.h, 0.12, w.mat);
  }
  addCyl(w.x, w.y, Math.max(1.1, w.r * 0.16), w.z + w.h, 0.3, w.mat === 'gold' ? 'gold' : 'steel');
  if (w.spokes) {
    for (let i = 0; i < w.spokes; i++) {
      const a = (i * 2 * Math.PI) / w.spokes;
      const len = w.r * 0.88;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, w.h), MAT[w.mat]);
      spoke.position.set(off(w.x) + (Math.cos(a) * len) / 2, off(w.y) + (Math.sin(a) * len) / 2, w.z + w.h / 2);
      spoke.rotation.z = a;
      spoke.castShadow = spoke.receiveShadow = true;
      toScene.add(spoke);
    }
  }
}

// column wheel: base ratchet + seven pillars + gold cap
const c = parts.column;
addCyl(c.x, c.y, c.rBase, c.z, 0.7, 'steel');
for (let i = 0; i < 7; i++) {
  const a = (i * 2 * Math.PI) / 7;
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, 2.2), MAT.steel);
  pillar.position.set(off(c.x) + Math.cos(a) * (c.rCol - 0.9), off(c.y) + Math.sin(a) * (c.rCol - 0.9), c.z + 0.7 + 1.1);
  pillar.rotation.z = a;
  pillar.castShadow = pillar.receiveShadow = true;
  toScene.add(pillar);
}
addCyl(c.x, c.y, c.rCap, c.z + 2.9, 0.5, 'gold');

// balance: rim torus + bar + screws, animated at 2.5 Hz
const bal = parts.balance;
const balanceGroup = new THREE.Group();
balanceGroup.position.set(off(bal.x), off(bal.y), bal.z);
const rim = new THREE.Mesh(new THREE.TorusGeometry(bal.rim, 0.7, 14, 64), MAT.gold);
rim.castShadow = rim.receiveShadow = true;
balanceGroup.add(rim);
const bar = new THREE.Mesh(new THREE.BoxGeometry(bal.rim * 2 - 1, 1.1, 0.55), MAT.gold);
bar.castShadow = true;
balanceGroup.add(bar);
for (let i = 0; i < 12; i++) {
  const a = (i * 2 * Math.PI) / 12;
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.5, 16), MAT.gold);
  screw.geometry.rotateX(Math.PI / 2);
  screw.position.set(Math.cos(a) * bal.rim, Math.sin(a) * bal.rim, 0.3);
  screw.castShadow = true;
  balanceGroup.add(screw);
}
toScene.add(balanceGroup);

// hairspring: tube along the emitted spiral (in the balance plane, above the wheel)
const spiralPts = parts.spiral.map(([x, y]) => new THREE.Vector3(off(x), off(y), bal.z + 0.9));
const spiralCurve = new THREE.CatmullRomCurve3(spiralPts);
const spring = new THREE.Mesh(new THREE.TubeGeometry(spiralCurve, 420, 0.14, 6), MAT.blued);
toScene.add(spring);

// jewels, chatons, screws
for (const [x, y, z] of parts.jewels) {
  addCyl(x, y, 1.15, z, 0.2, 'cavity');
  const ruby = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 14), MAT.ruby);
  ruby.position.set(off(x), off(y), z + 0.45);
  ruby.scale.z = 0.55;
  ruby.castShadow = true;
  toScene.add(ruby);
}
for (const [x, y, z] of parts.chatons) {
  addCyl(x, y, 1.85, z, 0.5, 'gold');
  const ruby = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 14), MAT.ruby);
  ruby.position.set(off(x), off(y), z + 0.72);
  ruby.scale.z = 0.55;
  toScene.add(ruby);
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
    addCyl(x + Math.cos(a) * 2.9, y + Math.sin(a) * 2.9, 0.62, z, 0.5, 'blued');
  }
}
for (const [x, y, z, kind] of parts.screws) {
  addCyl(x, y, 0.72, z, 0.45, kind === 'b' ? 'blued' : 'steel');
  const slot = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.2, 0.14), MAT.cavity);
  slot.position.set(off(x), off(y), z + 0.48);
  slot.rotation.z = (x * 7 + y * 13) % Math.PI;
  toScene.add(slot);
}

// pointer parallax + 2.5 Hz balance
let targetRX = 0, targetRY = 0;
addEventListener('pointermove', e => {
  targetRY = ((e.clientX / innerWidth) - 0.5) * 0.55;
  targetRX = ((e.clientY / innerHeight) - 0.5) * 0.45;
});
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
renderer.setAnimationLoop(t => {
  root.rotation.y += (targetRY - root.rotation.y) * 0.06;
  root.rotation.x += (targetRX - root.rotation.x) * 0.06;
  if (!reduceMotion) balanceGroup.rotation.z = Math.sin((t / 1000) * Math.PI * 5) * 2.06;
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
