import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All coordinates are in metres, Y up, with the face toward positive Z.
const output = fileURLToPath(new URL('../client/public/models/ice-golem/ice_golem.glb', import.meta.url));
const scene = new THREE.Scene();
const root = new THREE.Group();
root.name = 'IceGolem_Root';
scene.add(root);
const armature = new THREE.Group();
armature.name = 'IceGolem_Armature';
root.add(armature);

const materials = {
  Ice_Base: new THREE.MeshStandardMaterial({ name: 'Ice_Base', color: 0xb0d9eb, roughness: 0.33, metalness: 0, vertexColors: true }),
  Ice_Dark: new THREE.MeshStandardMaterial({ name: 'Ice_Dark', color: 0x274a68, roughness: 0.48, metalness: 0, vertexColors: true }),
  Ice_Crystal: new THREE.MeshPhysicalMaterial({ name: 'Ice_Crystal', color: 0xc7efff,
    roughness: 0.20, metalness: 0, transmission: 0.22, ior: 1.31, thickness: 0.16,
    vertexColors: true }),
  Ice_Emission: new THREE.MeshStandardMaterial({ name: 'Ice_Emission', color: 0x138eaa, emissive: 0x00abd0, emissiveIntensity: 1.0, roughness: 0.22, vertexColors: true }),
  Ice_Fissure: new THREE.MeshStandardMaterial({ name: 'Ice_Fissure', color: 0x419ab5, emissive: 0x14acd6, emissiveIntensity: 0.65, roughness: 0.34, vertexColors: true }),
};
const materialNames = Object.keys(materials);
const parts = new Map();
function noise(a, b = 0, c = 0) { return Math.sin(a * 15.73 + b * 43.17 + c * 79.91) * 0.055 + Math.sin(a * 41.3 - b * 13.1 + c * 17.7) * 0.025; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;

const bones = new Map();
function bone(name, parent, world) {
  const node = new THREE.Bone(); node.name = name;
  const p = parent ? bones.get(parent) : armature;
  node.position.copy(world).sub(parent ? p.userData.world : V(0, 0, 0));
  node.userData.world = world;
  p.add(node); bones.set(name, node);
}
bone('Root', null, V(0, 0, 0));
bone('Pelvis', 'Root', V(0, 1.71, 0));
bone('Spine', 'Pelvis', V(0, 2.36, 0));
bone('Chest', 'Spine', V(0, 3.15, 0));
bone('Neck', 'Chest', V(0, 3.64, 0));
bone('Head', 'Neck', V(0, 3.84, 0));
for (const [label, s] of [['L', -1], ['R', 1]]) {
  bone(`UpperArm_${label}`, 'Chest', V(s * 1.03, 3.28, 0));
  bone(`LowerArm_${label}`, `UpperArm_${label}`, V(s * 1.31, 2.53, 0.02));
  bone(`Hand_${label}`, `LowerArm_${label}`, V(s * 1.43, 1.8, 0.17));
  bone(`UpperLeg_${label}`, 'Pelvis', V(s * 0.43, 1.63, 0));
  bone(`LowerLeg_${label}`, `UpperLeg_${label}`, V(s * 0.49, 0.88, 0.08));
  bone(`Foot_${label}`, `LowerLeg_${label}`, V(s * 0.51, 0.23, 0.25));
}
armature.updateMatrixWorld(true);
const boneList = [...bones.values()];
const boneIndex = new Map(boneList.map((b, i) => [b.name, i]));

function part(name) {
  if (!parts.has(name)) parts.set(name, new Map());
  return parts.get(name);
}
function addGeometry(partName, material, positions, indices, boneName, colorFn = null, skinFn = null) {
  const n = positions.length / 3;
  if (partName === 'Head') for (let i = 0; i < n; i++) {
    positions[i * 3] *= 1.06;
    positions[i * 3 + 1] = 3.9 + (positions[i * 3 + 1] - 3.9) * 1.06;
    positions[i * 3 + 2] = .05 + (positions[i * 3 + 2] - .05) * 1.06;
  }
  const colors = [], skinIndices = [], skinWeights = [];
  const joint = boneIndex.get(boneName);
  if (joint === undefined) throw new Error(`Unknown bone ${boneName}`);
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    let shade = colorFn ? colorFn(x, y, z) : 0.91 + noise(x * 2, y * 2, z * 2) * 0.48;
    if (material === 'Ice_Base' && partName === 'Body' && z > .38) {
      shade -= .09 * tent((y - 2.86) / .15) * tent((Math.abs(x) - .55) / .38);
      shade += .045 * tent((y - 3.41) / .19) * tent((Math.abs(x) - .8) / .35);
    }
    if (material === 'Ice_Base' && partName.startsWith('Arm_') && z < 0) {
      shade -= .045 * tent((y - 2.95) / .45);
    }
    colors.push(shade, shade * (0.98 + 0.025 * Math.sin(i * 0.3)), Math.min(1, shade * 1.03));
    if (skinFn) {
      const influences = skinFn(x, y, z);
      for (let c = 0; c < 4; c++) {
        skinIndices.push(boneIndex.get(influences[c]?.[0]) ?? 0);
        skinWeights.push(influences[c]?.[1] ?? 0);
      }
    } else { skinIndices.push(joint, 0, 0, 0); skinWeights.push(1, 0, 0, 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  g.setIndex(indices);
  g.computeVertexNormals();
  const group = part(partName);
  if (!group.has(material)) group.set(material, []);
  group.get(material).push(g);
}

// Lofted, displaced ring surface. Profiles are [x, y, z, radiusX, radiusZ].
function loft(name, mat, profiles, joint, around = 40, along = 28, phase = 0) {
  const positions = [], indices = [];
  for (let row = 0; row <= along; row++) {
    const f = row / along * (profiles.length - 1);
    const k = Math.min(profiles.length - 2, Math.floor(f));
    const t = f - k;
    const p = profiles[k].map((v, i) => lerp(v, profiles[k + 1][i], t));
    for (let col = 0; col <= around; col++) {
      const theta = 2 * Math.PI * col / around;
      const faceting = 1 + noise(col * 0.47 + phase, row * 0.38, phase) * 0.52;
      const ridge = 1 + 0.025 * Math.cos(theta * 6 + phase);
      positions.push(p[0] + Math.cos(theta) * p[3] * faceting * ridge,
        p[1] + noise(col * 0.22, row * 0.29, phase) * 0.018,
        p[2] + Math.sin(theta) * p[4] * faceting * ridge);
      if (row && col) {
        const a = (row - 1) * (around + 1) + col - 1;
        const b = a + around + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const firstCenter = positions.length / 3;
  positions.push(profiles[0][0], profiles[0][1], profiles[0][2]);
  const lastCenter = positions.length / 3;
  positions.push(profiles.at(-1)[0], profiles.at(-1)[1], profiles.at(-1)[2]);
  const lastRow = along * (around + 1);
  for (let col = 0; col < around; col++) {
    indices.push(firstCenter, col, col + 1);
    indices.push(lastCenter, lastRow + col + 1, lastRow + col);
  }
  addGeometry(name, mat, positions, indices, joint);
}

function shaft(name, mat, start, end, wide, depth, joint, around = 40, along = 28, taper = [0.65, 1, 0.88, 0.62]) {
  const axis = end.clone().sub(start).normalize();
  const side = V(1, 0, 0).addScaledVector(axis, -axis.x).normalize();
  const forward = new THREE.Vector3().crossVectors(side, axis).normalize();
  const positions = [], indices = [];
  for (let row = 0; row <= along; row++) {
    const t = row / along, f = t * (taper.length - 1), k = Math.min(taper.length - 2, Math.floor(f));
    const radius = lerp(taper[k], taper[k + 1], f - k);
    const c = start.clone().lerp(end, t);
    for (let col = 0; col <= around; col++) {
      const angle = 2 * Math.PI * col / around;
      const n = 1 + noise(col * 0.37, row * 0.43, wide) * 0.66;
      const p = c.clone().addScaledVector(side, Math.cos(angle) * wide * radius * n)
        .addScaledVector(forward, Math.sin(angle) * depth * radius * n);
      positions.push(p.x, p.y, p.z);
      if (row && col) { const a = (row - 1) * (around + 1) + col - 1, b = a + around + 1; indices.push(a, b, a + 1, a + 1, b, b + 1); }
    }
  }
  const firstCenter = positions.length / 3;
  positions.push(start.x, start.y, start.z);
  const lastCenter = positions.length / 3;
  positions.push(end.x, end.y, end.z);
  const lastRow = along * (around + 1);
  for (let col = 0; col < around; col++) {
    indices.push(firstCenter, col, col + 1);
    indices.push(lastCenter, lastRow + col + 1, lastRow + col);
  }
  addGeometry(name, mat, positions, indices, joint);
}

function ribbon(name, mat, points, width, joint, skinFn = null) {
  const positions = [], indices = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], next = points[Math.min(points.length - 1, i + 1)], prev = points[Math.max(0, i - 1)];
    const d = next.clone().sub(prev).normalize();
    const localWidth = Array.isArray(width) ? width[i] : width;
    const side = V(-d.y, d.x, 0).multiplyScalar(localWidth * (i === 0 || i === points.length - 1 ? 0.35 : 1));
    for (const s of [-1, 1]) { const v = p.clone().addScaledVector(side, s); positions.push(v.x, v.y, v.z); }
    if (i) { const a = (i - 1) * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  addGeometry(name, mat, positions, indices, joint, () => 1, skinFn);
}

function createCrystal(name, material, base, tip, radius, joint, seed = 0, sides = 6) {
  const direction = tip.clone().sub(base).normalize();
  const reference = Math.abs(direction.y) < .9 ? V(0, 1, 0) : V(0, 0, 1);
  const side = new THREE.Vector3().crossVectors(direction, reference).normalize();
  const forward = new THREE.Vector3().crossVectors(side, direction).normalize();
  const positions = [], indices = [], rings = 5;
  for (let row = 0; row <= rings; row++) {
    const t = row / rings;
    const r = radius * [0.65, 1, .82, .58, .28, .015][row];
    const center = base.clone().lerp(tip, t);
    for (let col = 0; col < sides; col++) {
      const theta = col * 2 * Math.PI / sides + t * .10;
      const irregular = 1 + .14 * Math.sin(seed * 1.71 + col * 2.11) + .06 * Math.cos(row * 1.83 + col * 3.13);
      const p = center.clone().addScaledVector(side, Math.cos(theta) * r * irregular)
        .addScaledVector(forward, Math.sin(theta) * r * irregular);
      positions.push(p.x, p.y, p.z);
      if (row) {
        const a = (row - 1) * sides + col, b = row * sides + col, next = (col + 1) % sides;
        indices.push(a, b, (row - 1) * sides + next, (row - 1) * sides + next, b, row * sides + next);
      }
    }
  }
  const center = positions.length / 3;
  positions.push(base.x, base.y, base.z);
  for (let col = 0; col < sides; col++) indices.push(center, (col + 1) % sides, col);
  addGeometry(name, material, positions, indices, joint,
    (x, y, z) => .85 + .10 * smooth(.28, .95, V(x, y, z).sub(base).dot(direction) / base.distanceTo(tip))
      + .035 * Math.sin(x * 7 + y * 13 + z * 5 + seed));
}

function createIcePlate(name, material, outline, depth, joint, outward = V(0, 0, 1)) {
  const face = outline.map(p => p.clone());
  const cross = face[1].clone().sub(face[0]).cross(face[2].clone().sub(face[0]));
  if (cross.dot(outward) < 0) face.reverse();
  const positions = [], indices = [], n = face.length;
  for (const layer of [1, -1]) for (const p of face) {
    const q = p.clone().addScaledVector(outward, layer * depth * .5);
    positions.push(q.x, q.y, q.z);
  }
  for (let i = 1; i < n - 1; i++) {
    indices.push(0, i, i + 1);
    indices.push(n, n + i + 1, n + i);
  }
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    indices.push(i, n + i, next, next, n + i, n + next);
  }
  const plane = face.reduce((sum, p) => sum + p.dot(outward), 0) / n;
  addGeometry(name, material, positions, indices, joint,
    (x, y, z) => .84 + .12 * smooth(-depth*.5, depth*.5, V(x,y,z).dot(outward) - plane));
}

function smooth(a, b, x) { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function tent(x) { return Math.max(0, 1 - Math.abs(x)); }
function torsoSkin(x, y) {
  const pelvis = 1 - smooth(1.85, 2.30, y);
  const chest = smooth(2.64, 3.02, y);
  return [['Spine', 1 - Math.max(pelvis, chest)], ['Pelvis', pelvis], ['Chest', chest]];
}
function profileValue(y, points) {
  if (y <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (y <= points[i][0]) return lerp(points[i - 1][1], points[i][1], (y - points[i - 1][0]) / (points[i][0] - points[i - 1][0]));
  }
  return points.at(-1)[1];
}

function createTorsoGeometry() {
  // One closed shell: angular iliac crest, narrow waist, broad chest, high traps.
  // The pectorals, sternum and abdominal plates displace this shell, not overlays.
  const rings = [
    [1.30, .49, .36, .02], [1.50, .64, .39, .01], [1.68, .69, .37, 0],
    [1.90, .46, .31, -.02], [2.13, .49, .34, -.03], [2.37, .60, .39, -.04],
    [2.65, .82, .44, -.06], [2.91, 1.04, .51, -.07], [3.19, 1.11, .50, -.07],
    [3.39, .98, .42, -.06], [3.56, .74, .35, -.02], [3.69, .40, .26, 0],
  ];
  const around = 28, steps = 2, positions = [], indices = [];
  for (let band = 0; band < rings.length - 1; band++) {
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const [y, rx, rz, cz] = rings[band].map((v, i) => lerp(v, rings[band + 1][i], t));
      for (let col = 0; col < around; col++) {
        const theta = col * Math.PI * 2 / around;
        let x = Math.sign(Math.cos(theta)) * Math.pow(Math.abs(Math.cos(theta)), .84) * rx;
        const front = Math.max(0, Math.sin(theta));
        const back = Math.max(0, -Math.sin(theta));
        const pecPlate = profileValue(y, [[2.67, 0], [2.80, .025], [2.89, .17], [3.08, .23], [3.23, .22], [3.40, .04], [3.54, 0]]);
        const pec = 1.55 * pecPlate * tent((Math.abs(x) - .49) / .44);
        const sternum = profileValue(y, [[2.15, 0], [2.45, .06], [2.87, .12], [3.23, .13], [3.55, .03], [3.68, 0]]) * tent(x / .19);
        const innerPecCrease = .14 * tent((Math.abs(x) - .22) / .115) * tent((y - 3.09) / .33);
        const lowerPecCrease = .047 * tent((y - 2.84) / .09) * tent((Math.abs(x) - .48) / .43);
        const abdomen = [2.12, 2.34, 2.55].reduce((sum, center) => sum + .068 * tent((y - center) / .12), 0)
          * tent((Math.abs(x) - .22) / .30);
        const oblique = .05 * tent((Math.abs(x) - .50) / .22) * tent((y - 2.30) / .42);
        const iliac = .055 * tent((Math.abs(x) - .46) / .24) * tent((y - 1.64) / .19);
        const trap = .065 * tent((y - 3.47) / .22) * Math.abs(x);
        const surface = noise(col * .45, band, 11) * .05;
        let z = cz + Math.sign(Math.sin(theta)) * Math.pow(Math.abs(Math.sin(theta)), .56) * rz
          + front * (pec + sternum + abdomen + oblique + iliac - innerPecCrease - lowerPecCrease)
          - back * (.045 * tent((y - 2.9) / .6)) + surface;
        x += Math.sign(x) * trap;
        positions.push(x, y, z);
      }
    }
  }
  const [y, rx, rz, cz] = rings.at(-1);
  for (let col = 0; col < around; col++) {
    const theta = col * Math.PI * 2 / around;
    positions.push(Math.cos(theta) * rx, y, cz + Math.sin(theta) * rz);
  }
  const rowCount = (rings.length - 1) * steps + 1;
  for (let row = 1; row < rowCount; row++) for (let col = 0; col < around; col++) {
    const a = (row - 1) * around + col, b = row * around + col, c = (col + 1) % around;
    indices.push(a, b, (row - 1) * around + c, (row - 1) * around + c, b, row * around + c);
  }
  const bottom = positions.length / 3; positions.push(0, rings[0][0], 0);
  const top = positions.length / 3; positions.push(0, y, cz);
  for (let col = 0; col < around; col++) {
    const next = (col + 1) % around;
    indices.push(bottom, next, col);
    indices.push(top, (rowCount - 1) * around + col, (rowCount - 1) * around + next);
  }
  addGeometry('Body', 'Ice_Base', positions, indices, 'Spine', null, torsoSkin);
}

function createContinuousLimb(name, profiles, upperBone, lowerBone, jointY, around = 18, steps = 3) {
  // Profiles: [Y, X, Z, lateral radius, front radius]. Upper and lower share
  // the knee/elbow ring and interpolate weights across it, so there is no gap.
  const positions = [], indices = [];
  for (let band = 0; band < profiles.length - 1; band++) for (let step = 0; step < steps; step++) {
    const t = step / steps;
    const [y, cx, cz, rx, rz] = profiles[band].map((v, i) => lerp(v, profiles[band + 1][i], t));
    for (let col = 0; col < around; col++) {
      const theta = col * 2 * Math.PI / around;
      const faceted = 1 + .05 * Math.cos(theta * 4 + .35) + .025 * Math.cos(theta * 7 + band * .4);
      const front = Math.max(0, Math.sin(theta));
      const back = Math.max(0, -Math.sin(theta));
      const arm = name.startsWith('Arm');
      const frontMuscle = arm
        ? .095 * tent((y - 2.99) / .30) + .095 * tent((y - 2.12) / .34) + .095 * tent((y - 2.51) / .09)
        : .11 * tent((y - 1.34) / .32) + .11 * tent((y - .91) / .105);
      const rearMuscle = arm ? .065 * tent((y - 3.03) / .31) : .14 * tent((y - .54) / .29);
      const lateral = arm ? .035 * tent((y - 3.09) / .30) : .075 * tent((y - 1.35) / .30);
      positions.push(cx + Math.cos(theta) * (rx * faceted + lateral * Math.abs(Math.cos(theta))), y,
        cz + Math.sin(theta) * rz * faceted + front * frontMuscle - back * rearMuscle);
    }
  }
  const last = profiles.at(-1);
  for (let col = 0; col < around; col++) {
    const theta = col * 2 * Math.PI / around;
    positions.push(last[1] + Math.cos(theta) * last[3], last[0], last[2] + Math.sin(theta) * last[4]);
  }
  const rowCount = (profiles.length - 1) * steps + 1;
  for (let row = 1; row < rowCount; row++) for (let col = 0; col < around; col++) {
    const a = (row - 1) * around + col, b = row * around + col, c = (col + 1) % around;
    indices.push(a, (row - 1) * around + c, b, (row - 1) * around + c, row * around + c, b);
  }
  const upperCenter = positions.length / 3; positions.push(profiles[0][1], profiles[0][0], profiles[0][2]);
  const lowerCenter = positions.length / 3; positions.push(last[1], last[0], last[2]);
  for (let col = 0; col < around; col++) {
    const next = (col + 1) % around;
    indices.push(upperCenter, col, next);
    indices.push(lowerCenter, (rowCount - 1) * around + next, (rowCount - 1) * around + col);
  }
  addGeometry(name, 'Ice_Base', positions, indices, upperBone, null, (x, y) => {
    const upper = smooth(jointY - .14, jointY + .14, y);
    return [[upperBone, upper], [lowerBone, 1 - upper]];
  });
}

function createUpperArmGeometry(label, s) { return [
  [3.55, s*.88, -.01, .19, .20], [3.39, s*.99, 0, .34, .30],
  [3.27, s*1.07, .01, .39, .34],
  [3.05, s*1.20, .02, .34, .31], [2.83, s*1.29, .04, .27, .27],
  [2.62, s*1.34, .05, .20, .21],
]; }
function createForearmGeometry(label, s) { return [
  [2.49, s*1.36, .06, .21, .22], [2.35, s*1.39, .08, .34, .29],
  [2.16, s*1.43, .10, .47, .40], [1.98, s*1.46, .13, .50, .42],
  [1.82, s*1.47, .17, .43, .38], [1.70, s*1.48, .19, .26, .25],
]; }
function createThighGeometry(label, s) { return [
  [1.72, s*.40, 0, .27, .29], [1.55, s*.43, .015, .39, .37],
  [1.34, s*.47, .03, .45, .41], [1.12, s*.49, .06, .35, .33],
  [.93, s*.50, .09, .25, .26],
]; }
function createLowerLegGeometry(label, s) { return [
  [.83, s*.50, .10, .25, .27], [.68, s*.51, .13, .37, .35],
  [.51, s*.52, .15, .43, .40], [.34, s*.53, .17, .35, .33],
  [.18, s*.53, .20, .23, .24],
]; }
function createFootGeometry(label, s) {
  // One closed shell from heel to five broad lobes at the front. The high
  // instep overlaps the existing calf, keeping its approved mesh untouched.
  const columns = 30, rows = 12, stride = columns + 1;
  const positions = [], indices = [], layerSize = (rows + 1) * stride;
  for (let layer = 0; layer < 2; layer++) for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    for (let col = 0; col <= columns; col++) {
      const u = col / columns * 2 - 1;
      const toe = Math.pow(.5 + .5 * Math.cos(5 * Math.PI * u), 1.8);
      const front = .76 + .21 * toe * (1 - .18 * Math.abs(u));
      const z = -.26 + (front + .26) * t;
      const width = .23 + .22 * smooth(.02, .78, t) - .035 * smooth(.82, 1, t);
      const x = s*.53 + u * width;
      const ankle = .30 * Math.exp(-Math.pow((z - .06) / .30, 2))
        * (.18 + .82 * Math.sqrt(Math.max(0, 1 - u*u)));
      const instep = .055 * Math.exp(-Math.pow((z - .42) / .30, 2)) * (1-u*u);
      const toeRidge = .09 * toe * smooth(.55, .86, t) * (1 - .65 * smooth(.90, 1, t));
      const y = layer === 0 ? .08 + ankle + instep + toeRidge
        : .018 + .018 * (1 - toe) * smooth(.82, 1, t);
      positions.push(x, y, z);
      if (layer === 0 && row && col) {
        const a = (row-1)*stride+col-1, b = row*stride+col-1;
        indices.push(a,b,a+1, a+1,b,b+1);
        indices.push(layerSize+a,a+layerSize+1,layerSize+b,
          layerSize+a+1,layerSize+b+1,layerSize+b);
      }
    }
  }
  const edge = [];
  for (let col = 0; col <= columns; col++) edge.push(rows*stride+col);
  for (let row = rows-1; row >= 0; row--) edge.push(row*stride+columns);
  for (let col = columns-1; col >= 0; col--) edge.push(col);
  for (let row = 1; row < rows; row++) edge.push(row*stride);
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i+1)%edge.length];
    indices.push(a,a+layerSize,b, b,a+layerSize,b+layerSize);
  }
  addGeometry(`Foot_${label}`, 'Ice_Base', positions, indices, `Foot_${label}`,
    (x, y, z) => .80 + .14 * smooth(.025, .22, y) + noise(x*3,y*3,z*3)*.16);
}
function createHandGeometry(label, s) {
  const name = `Hand_${label}`, joint = name, x = s * 1.48;
  loft(name, 'Ice_Base', [
    [x, 1.32, .27, .33, .22], [x, 1.48, .24, .38, .26],
    [x, 1.63, .21, .32, .23], [x, 1.78, .18, .21, .18],
  ], joint, 12, 12, s * 3);
  for (let i = 0; i < 4; i++) {
    const offset = (i - 1.5) * .19;
    const fingerX = x + offset;
    const endY = 1.075 + Math.abs(i - 1.5) * .037 + i*.006;
    shaft(name, 'Ice_Base', V(fingerX, 1.40, .33), V(fingerX + offset*.11, 1.22, .38),
      .097, .093, joint, 8, 6, [.92, 1.05, 1, .87]);
    shaft(name, 'Ice_Base', V(fingerX + offset*.11, 1.25, .38), V(fingerX + offset*.20, endY, .45),
      .087, .080, joint, 8, 6, [.9, 1.04, .86, .54]);
    createIcePlate(name, 'Ice_Crystal', [V(fingerX-.075, 1.44, .45),
      V(fingerX+.075, 1.44, .45), V(fingerX+.06, 1.33, .51),
      V(fingerX-.06, 1.33, .51)], .03, joint);
  }
  const thumbX = x - s*.28;
  shaft(name, 'Ice_Base', V(thumbX, 1.58, .32), V(thumbX-s*.14, 1.41, .42),
    .115, .10, joint, 8, 6, [.78, 1.1, .94, .7]);
  shaft(name, 'Ice_Base', V(thumbX-s*.12, 1.43, .41), V(thumbX-s*.19, 1.29, .49),
    .091, .085, joint, 8, 6, [.94, 1, .83, .52]);
}

function createHeadGeometry() {
  // Larger jaw, brow and cheek planes; details stay simple while the body is judged.
  loft('Head', 'Ice_Dark', [[0, 3.57, .04, .23, .18], [0, 3.74, .05, .35, .26], [0, 3.95, .04, .38, .26], [0, 4.13, .01, .39, .28], [0, 4.28, -.04, .34, .23]], 'Head', 20, 20, 13);
  loft('Head', 'Ice_Base', [[0, 3.60, .25, .22, .09], [0, 3.77, .25, .33, .13], [0, 3.91, .22, .36, .13]], 'Head', 18, 16, 3);
  for (const s of [-1, 1]) {
    shaft('Head', 'Ice_Base', V(s*.04, 4.07, .29), V(s*.37, 4.14, .27), .095, .07, 'Head', 8, 8);
    shaft('Head', 'Ice_Base', V(s*.13, 3.79, .31), V(s*.39, 3.95, .25), .12, .07, 'Head', 8, 8);
    shaft('Head', 'Ice_Dark', V(s*.13, 4.025, .32), V(s*.31, 4.04, .33), .054, .035, 'Head', 8, 5);
  }
  shaft('Head', 'Ice_Base', V(0, 4.08, .28), V(0, 3.79, .47), .105, .10, 'Head', 8, 10);
  ribbon('Head', 'Ice_Dark', [V(-.20, 3.72, .38), V(-.09, 3.69, .42), V(0, 3.70, .44), V(.11, 3.69, .42), V(.20, 3.72, .38)], .025, 'Head');
  for (const s of [-1, 1]) ribbon('Head', 'Ice_Emission',
    [V(s*.13, 4.03, .37), V(s*.21, 4.045, .38), V(s*.31, 4.015, .36)],
    [.007, .018, .005], 'Head');
}

function createBeardGeometry() {
  loft('Beard', 'Ice_Dark', [[0, 3.50, .28, .12, .08], [0, 3.66, .30, .23, .12],
    [0, 3.78, .29, .25, .12]], 'Head', 12, 10, 4);
  const strands = [
    [0, 3.72, 3.12, .125, .75], [-.13, 3.72, 3.26, .105, .67], [.13, 3.71, 3.30, .105, .68],
    [-.23, 3.73, 3.37, .087, .58], [.23, 3.73, 3.36, .087, .57],
    [-.32, 3.76, 3.44, .067, .51], [.32, 3.76, 3.45, .067, .52],
    [-.18, 3.68, 3.45, .061, .74], [.18, 3.69, 3.42, .061, .72],
    [-.38, 3.78, 3.53, .045, .47], [.38, 3.78, 3.54, .045, .47],
  ];
  for (let i = 0; i < strands.length; i++) {
    const [x, top, bottom, radius, front] = strands[i];
    createCrystal('Beard', i % 3 ? 'Ice_Crystal' : 'Ice_Base',
      V(x*.82, top, i > 6 ? .42 : .35), V(x*1.18, bottom, front), radius, 'Head', 20 + i, 7);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    createCrystal('Beard', 'Ice_Base', V(s*(.055+i*.10), 3.80-i*.025, .35),
      V(s*(.08+i*.13), 3.56-i*.06, .50), .045, 'Head', 40+i+s, 5);
  }
}

function createHornGeometry(label, s) {
  // Segmented curve, irregular polygonal cross section and progressive taper.
  const curve = new THREE.CatmullRomCurve3([V(s*.29, 4.15, -.02), V(s*.49, 4.22, -.08),
    V(s*.66, 4.34, -.13), V(s*.75, 4.47, -.17), V(s*.67, 4.55, -.16), V(s*.48, 4.61, -.11)]);
  const positions = [], indices = [], sides = 9, segments = 25;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, p = curve.getPoint(t), tangent = curve.getTangent(t);
    const side = V(0, 0, 1).cross(tangent).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, side).normalize();
    const radius = .19 * Math.pow(1 - t, 1.18) * (1 + .045 * Math.cos(t * 32)) + .00015;
    for (let j = 0; j <= sides; j++) {
      const a = j * 2 * Math.PI / sides;
      const facet = 1 + .10 * Math.cos(j * 2.4 + s) + .035 * Math.sin(i * 1.5 + j);
      const v = p.clone().addScaledVector(side, Math.cos(a) * radius * facet)
        .addScaledVector(normal, Math.sin(a) * radius * (1 + .07 * Math.sin(j * 1.7)));
      positions.push(v.x, v.y, v.z);
      if (i && j) { const a = (i-1)*(sides+1)+j-1, b=a+sides+1; indices.push(a,a+1,b,a+1,b+1,b); }
    }
  }
  addGeometry(`Horn_${label}`, 'Ice_Base', positions, indices, 'Head',
    (x, y) => .70 + .24 * smooth(4.15, 4.60, y));
}

createTorsoGeometry();
createHeadGeometry();
createBeardGeometry();
for (const [label, s] of [['L', -1], ['R', 1]]) createHornGeometry(label, s);

// Continuous upper/lower limb surfaces: the elbow and knee are shared rings.
for (const [label, s] of [['L', -1], ['R', 1]]) {
  const arm = `Arm_${label}`;
  createContinuousLimb(arm, [...createUpperArmGeometry(label, s), ...createForearmGeometry(label, s)],
    `UpperArm_${label}`, `LowerArm_${label}`, 2.53);
  createHandGeometry(label, s);
}

for (const [label, s] of [['L', -1], ['R', 1]]) {
  const leg = `Leg_${label}`;
  createContinuousLimb(leg, [...createThighGeometry(label, s), ...createLowerLegGeometry(label, s)], `UpperLeg_${label}`, `LowerLeg_${label}`, .87);
  createFootGeometry(label, s);
}

// Probe only the anatomical meshes, before decorative geometry is added. This
// makes crack paths and armor plates follow the actual displaced surfaces.
const surfaceMeshes = new Map();
function frontSurface(partName, x, y) {
  if (!surfaceMeshes.has(partName)) {
    const chunks = parts.get(partName)?.get('Ice_Base');
    if (!chunks?.length) throw new Error(`No body surface for ${partName}`);
    surfaceMeshes.set(partName, new THREE.Mesh(
      mergeGeometries(chunks, false),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    ));
  }
  const ray = new THREE.Raycaster(V(x, y, 3), V(0, 0, -1), 0, 6);
  const hit = ray.intersectObject(surfaceMeshes.get(partName), false)[0];
  if (!hit) throw new Error(`No ${partName} surface at ${x}, ${y}`);
  return hit.point.z;
}
function surfacePath(partName, points, gap = .026) {
  return points.map(([x, y]) => V(x, y, frontSurface(partName, x, y) + gap));
}

function createShoulderArmor(label, s) {
  const name = `Shoulder_${label}`, joint = `UpperArm_${label}`;
  shaft(name, 'Ice_Dark', V(s*.88, 3.49, -.06), V(s*1.43, 3.29, -.05),
    .25, .30, joint, 8, 8, [.72, 1.1, 1.05, .64]);
  createIcePlate(name, 'Ice_Base', [V(s*.97, 3.58, .19), V(s*1.32, 3.58, .28),
    V(s*1.64, 3.36, .25), V(s*1.40, 3.19, .28), V(s*1.10, 3.30, .25)], .09, joint);
  createCrystal(name, 'Ice_Crystal', V(s*1.15, 3.51, -.06), V(s*1.38, 4.30, -.22), .225, joint, 71+s, 8);
  createCrystal(name, 'Ice_Crystal', V(s*1.30, 3.43, .15), V(s*1.66, 4.00, .25), .16, joint, 81+s, 7);
  createCrystal(name, 'Ice_Crystal', V(s*1.24, 3.46, -.26), V(s*1.51, 4.02, -.48), .15, joint, 91+s, 7);
  createCrystal(name, 'Ice_Base', V(s*1.43, 3.31, .02), V(s*1.81, 3.59, .07), .12, joint, 101+s, 6);
  for (let i = 0; i < 2; i++) createCrystal(name, 'Ice_Base',
    V(s*(1.07+i*.24), 3.52-i*.09, .25), V(s*(1.17+i*.28), 3.74-i*.06, .34),
    .055, joint, 111+i+s, 5);
}

function createBackCrystals() {
  const name = 'Back_Crystals';
  // Three overlapping clusters share broad roots instead of forming a picket line.
  createCrystal(name, 'Ice_Dark', V(0, 3.46, -.42), V(0, 3.80, -.71), .30, 'Chest', 129, 8);
  createCrystal(name, 'Ice_Crystal', V(0, 3.48, -.55), V(.025, 4.53, -.99), .27, 'Chest', 130, 8);
  for (const s of [-1, 1]) {
    createCrystal(name, 'Ice_Dark', V(s*.44, 3.41, -.40), V(s*.55, 3.77, -.67), .24, 'Chest', 138+s, 7);
    createCrystal(name, 'Ice_Crystal', V(s*.43, 3.48, -.51),
      V(s*(s < 0 ? .66 : .62), s < 0 ? 4.24 : 4.16, -.91), .20, 'Chest', 140+s, 7);
    createCrystal(name, 'Ice_Base', V(s*.54, 3.42, -.49), V(s*.77, 3.92, -.79), .13, 'Chest', 150+s, 6);
    createCrystal(name, 'Ice_Base', V(s*.18, 3.45, -.58), V(s*.27, 3.89, -.85), .105, 'Chest', 160+s, 6);
  }
}

function createChestRefinement() {
  for (const s of [-1, 1]) {
    const outer = [[s*.52,3.40],[s*.71,3.37],[s*.83,3.27],[s*.77,3.19],[s*.58,3.30]]
      .map(([x,y]) => V(x,y,frontSurface('Body',x,y)+.022));
    createIcePlate('Chest_Plates', 'Ice_Base', outer, .045, 'Chest');
    const lower = [[s*.57,2.89],[s*.72,2.93],[s*.78,2.87],[s*.65,2.84]]
      .map(([x,y]) => V(x,y,frontSurface('Body',x,y)+.022));
    createIcePlate('Chest_Plates', 'Ice_Crystal', lower, .025, 'Chest');
  }
}

function createChestCore() {
  const bezel = [V(0, 3.50, .55), V(.24, 3.20, .60), V(.21, 2.98, .61),
    V(0, 2.79, .60), V(-.21, 2.98, .61), V(-.24, 3.20, .60)];
  createIcePlate('Chest_Core', 'Ice_Dark', bezel, .09, 'Chest');
  const gem = [V(0, 3.44, .67), V(.15, 3.20, .69), V(.14, 3.07, .71),
    V(0, 2.87, .69), V(-.14, 3.07, .71), V(-.15, 3.20, .69)];
  createIcePlate('Chest_Core', 'Ice_Crystal', gem, .07, 'Chest');
  createCrystal('Chest_Core', 'Ice_Emission', V(0, 3.00, .74), V(0, 3.37, .84), .075, 'Chest', 170, 6);
}

function createWaistArmor() {
  for (let i = -3; i <= 3; i++) {
    const x = i * .165, long = 1 - Math.abs(i) / 4;
    createIcePlate('Waist_Armor', i % 2 ? 'Ice_Base' : 'Ice_Dark', [
      V(x-.09, 1.76, .35), V(x+.09, 1.76, .35), V(x+.105, 1.53, .43),
      V(x+.025, 1.27+Math.abs(i)*.05, .52), V(x-.11, 1.51, .43),
    ], .045 + .02*long, 'Pelvis');
  }
  for (const s of [-1, 1]) createIcePlate('Waist_Armor', 'Ice_Dark', [
    V(s*.54, 1.78, .16), V(s*.67, 1.67, .09), V(s*.74, 1.34, .09), V(s*.56, 1.42, .22),
  ], .07, 'Pelvis', V(s, 0, 0));
}

function createForearmArmor(label, s) {
  const limb = `Arm_${label}`, name = `Arm_Armor_${label}`, joint = `LowerArm_${label}`;
  const outline = [[s*1.38, 2.31], [s*1.56, 2.27], [s*1.60, 2.05],
    [s*1.48, 1.85], [s*1.29, 2.02]].map(([x,y]) => V(x,y,frontSurface(limb,x,y)+.025));
  createIcePlate(name, 'Ice_Crystal', outline, .05, joint);
  for (const [x,y,w] of [[1.36,2.27,.09],[1.54,2.12,.10],[1.42,1.91,.08]]) {
    const plate = [[s*(x-w),y+.075],[s*(x+w),y+.04],[s*(x+w*.62),y-.07],[s*(x-w*.75),y-.065]]
      .map(([px,py]) => V(px,py,frontSurface(limb,px,py)+.034));
    createIcePlate(name, 'Ice_Base', plate, .028, joint);
  }
  for (let i = 0; i < 2; i++) createCrystal(name, i ? 'Ice_Base' : 'Ice_Crystal',
    V(s*(1.81+i*.03), 2.25-i*.30, -.03), V(s*(2.12+i*.03), 2.48-i*.30, -.07),
    .095, joint, 190+i+s, 6);
}

function createLegArmor(label, s) {
  const limb = `Leg_${label}`, name = `Leg_Armor_${label}`;
  const knee = [[s*.50, 1.05], [s*.65, .91], [s*.52, .76], [s*.35, .91]]
    .map(([x,y]) => V(x,y,frontSurface(limb,x,y)+.026));
  createIcePlate(name, 'Ice_Crystal', knee, .052, `LowerLeg_${label}`);
  for (const dx of [-.17,.17]) {
    const side = [[s*(.50+dx),.99],[s*(.57+dx),.91],
      [s*(.50+dx),.83],[s*(.43+dx),.91]]
      .map(([x,y]) => V(x,y,frontSurface(limb,x,y)+.031));
    createIcePlate(name, 'Ice_Base', side, .035, `LowerLeg_${label}`);
  }
  const shin = [[s*.46, .73], [s*.62, .69], [s*.66, .43], [s*.53, .31], [s*.41, .48]]
    .map(([x,y]) => V(x,y,frontSurface(limb,x,y)+.024));
  createIcePlate(name, 'Ice_Base', shin, .048, `LowerLeg_${label}`);
  createCrystal(name, 'Ice_Crystal', V(s*.79, .62, -.05), V(s*.99, .82, -.12),
    .075, `LowerLeg_${label}`, 210+s, 6);
}

function createFissures() {
  for (const s of [-1, 1]) {
    const chestPaths = [
      [[s*.15,3.22],[s*.25,3.29],[s*.36,3.25],[s*.49,3.34],[s*.64,3.30],[s*.75,3.36]],
      [[s*.15,3.08],[s*.27,3.02],[s*.39,3.07],[s*.53,2.97],[s*.65,2.99]],
      [[s*.24,3.17],[s*.34,3.11],[s*.45,3.13],[s*.52,3.08]],
    ];
    for (let i = 0; i < chestPaths.length; i++) {
      const path = chestPaths[i];
      ribbon('Chest_Fissures', 'Ice_Fissure', surfacePath('Body', path),
        path.map((_, j) => (.022-i*.004) * (1-j/(path.length+1))), 'Chest', torsoSkin);
    }
    const arm = `Arm_${s < 0 ? 'L' : 'R'}`, leg = `Leg_${s < 0 ? 'L' : 'R'}`;
    ribbon('Arm_Fissures', 'Ice_Fissure', surfacePath(arm,
      [[s*1.42,2.26],[s*1.50,2.18],[s*1.45,2.06],[s*1.56,1.99]]),
    [.006,.009,.006,.003], `LowerArm_${s < 0 ? 'L' : 'R'}`);
    ribbon('Leg_Fissures', 'Ice_Fissure', surfacePath(leg,
      [[s*.48,1.40],[s*.52,1.29],[s*.47,1.21]]),
    [.004,.007,.003], `UpperLeg_${s < 0 ? 'L' : 'R'}`);
    ribbon('Leg_Fissures', 'Ice_Fissure', surfacePath(leg,
      [[s*.50,.69],[s*.57,.60],[s*.52,.50],[s*.57,.44]]),
    [.004,.007,.005,.002], `LowerLeg_${s < 0 ? 'L' : 'R'}`);
  }
}

for (const [label, s] of [['L', -1], ['R', 1]]) {
  createShoulderArmor(label, s);
  createForearmArmor(label, s);
  createLegArmor(label, s);
}
createBackCrystals();
createChestRefinement();
createWaistArmor();
createChestCore();
createFissures();
for (const mesh of surfaceMeshes.values()) {
  mesh.geometry.dispose(); mesh.material.dispose();
}

// Merge every material in each anatomical group: few draw calls, rigid bone weights
// on armor and a blended spine/pelvis/chest body skin.
const skeleton = new THREE.Skeleton(boneList);
skeleton.calculateInverses();
const facetedParts = new Set([
  'Body', 'Head', 'Beard', 'Horn_L', 'Horn_R', 'Shoulder_L', 'Shoulder_R',
  'Back_Crystals', 'Chest_Core', 'Chest_Plates', 'Waist_Armor', 'Arm_L', 'Arm_R',
  'Arm_Armor_L', 'Arm_Armor_R', 'Leg_L', 'Leg_R', 'Leg_Armor_L',
  'Leg_Armor_R', 'Foot_L', 'Foot_R', 'Hand_L', 'Hand_R',
]);
let meshes = 0, vertices = 0, indices = 0, triangles = 0;
for (const [name, materialGroups] of parts) {
  const group = new THREE.Group(); group.name = name; armature.add(group);
  for (const [materialName, chunks] of materialGroups) {
    let geometry = mergeGeometries(chunks, false);
    if (!geometry) throw new Error(`Could not merge ${name}/${materialName}`);
    if (facetedParts.has(name)) {
      const flat = geometry.toNonIndexed();
      geometry.dispose();
      geometry = flat;
      geometry.computeVertexNormals();
    }
    const mesh = new THREE.SkinnedMesh(geometry, materials[materialName]);
    mesh.name = `${name}_${materialName}`;
    mesh.bind(skeleton);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    meshes++;
    vertices += geometry.attributes.position.count;
    indices += geometry.index?.count ?? 0;
    triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    chunks.forEach(g => g.dispose());
  }
}
if (meshes > 60) throw new Error(`Too many skinned meshes: ${meshes}`);
root.updateMatrixWorld(true);
const unscaledBox = new THREE.Box3().setFromObject(root);
const fitScale = 4.5 / unscaledBox.getSize(new THREE.Vector3()).y;
root.scale.setScalar(fitScale);
root.position.y = -unscaledBox.min.y * fitScale;
root.updateMatrixWorld(true);

// Node has Blob but no browser FileReader. GLTFExporter only needs these methods.
if (!globalThis.FileReader) globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }).catch(error => this.onerror?.(error)); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }).catch(error => this.onerror?.(error)); }
};
const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(scene, { binary: true, onlyVisible: true, truncateDrawRange: true, animations: [], includeCustomExtensions: false });
await mkdir(fileURLToPath(new URL('../client/public/models/ice-golem/', import.meta.url)), { recursive: true });
await writeFile(output, Buffer.from(glb));
if (!existsSync(output)) throw new Error('GLB was not written');
const data = await readFile(output);
if (!data.byteLength) throw new Error('GLB is empty');
const parsed = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
const loadedRoot = parsed.scene.getObjectByName('IceGolem_Root');
if (!loadedRoot || !parsed.scene.getObjectByName('IceGolem_Armature')) throw new Error('GLB round trip lost the rig');
let loadedMeshes = 0;
loadedRoot.traverse(o => { if (o.isSkinnedMesh) loadedMeshes++; });
if (loadedMeshes !== meshes) throw new Error(`GLB round trip lost meshes: ${loadedMeshes}/${meshes}`);
const box = new THREE.Box3().setFromObject(parsed.scene);
console.log(JSON.stringify({ path: output, bytes: data.byteLength, mb: +(data.byteLength/1048576).toFixed(2), meshes, vertices, indices, triangles, materials: materialNames.length, bones: boneList.length, loadedMeshes, height: +box.getSize(new THREE.Vector3()).y.toFixed(3), minY: +box.min.y.toFixed(3) }, null, 2));
