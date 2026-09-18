import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { Box3, Raycaster, Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import {
  BOSS_GOLEM_URL,
  createBossGolemRig,
  prepareBossGolemAsset,
  updateBossGolemPose,
} from './BossGolemAsset.js';
import { EnemySystem } from './EnemySystem.js';

async function parseGameAsset() {
  const bytes = await readFile(new URL('../../public/models/ice-golem/ice_golem.glb', import.meta.url));
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
}

function boundaryEdges(geometry) {
  const counts = new Map();
  const index = geometry.index, position = geometry.attributes.position;
  const vertex = i => {
    const at = index ? index.getX(i) : i;
    return [position.getX(at), position.getY(at), position.getZ(at)]
      .map(value => value.toFixed(5)).join(',');
  };
  const count = index?.count ?? position.count;
  for (let i = 0; i < count; i += 3) {
    const triangle = [vertex(i), vertex(i + 1), vertex(i + 2)];
    for (let edge = 0; edge < 3; edge++) {
      const a = triangle[edge], b = triangle[(edge + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.values()].filter(count => count !== 2).length;
}

function widthAtY(geometry, y, tolerance = 0.025) {
  const position = geometry.attributes.position;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getY(i) - y) > tolerance) continue;
    min = Math.min(min, position.getX(i));
    max = Math.max(max, position.getX(i));
  }
  assert.ok(Number.isFinite(min) && Number.isFinite(max));
  return max - min;
}

test('GLB do chefão contém rig, partes, materiais e orçamento geométrico', async () => {
  const { scene } = await parseGameAsset();
  const root = prepareBossGolemAsset(scene).getObjectByName('IceGolem_Root');
  const materials = new Set();
  let triangles = 0;
  let skinnedMeshes = 0;
  root.traverse((object) => {
    if (!object.isSkinnedMesh) return;
    skinnedMeshes += 1;
    const index = object.geometry.index;
    triangles += index ? index.count / 3 : object.geometry.attributes.position.count / 3;
    materials.add(object.material.name);
    assert.ok(object.skeleton.bones.length >= 18);
  });
  const box = new Box3().setFromObject(scene);
  assert.ok(skinnedMeshes >= 30 && skinnedMeshes <= 60);
  assert.ok(triangles >= 15000 && triangles <= 22000, `${triangles} triângulos`);
  assert.deepEqual([...materials].sort(),
    ['Ice_Base', 'Ice_Crystal', 'Ice_Dark', 'Ice_Emission', 'Ice_Fissure']);
  const crystal = root.getObjectByName('Shoulder_L_Ice_Crystal');
  assert.ok(crystal?.material.isMeshPhysicalMaterial);
  assert.ok(Math.abs(crystal.material.transmission - 0.22) < 1e-6);
  assert.ok(Math.abs(crystal.material.ior - 1.31) < 1e-6);
  assert.ok(Math.abs(crystal.material.thickness - 0.16) < 1e-6);
  assert.equal(crystal.material.opacity, 1);
  assert.equal(crystal.material.transparent, false);
  const crystalColors = crystal.geometry.getAttribute('color');
  assert.ok(crystalColors?.count > 0);
  assert.ok(Array.from({ length: crystalColors.count }, (_, i) => crystalColors.getZ(i) - crystalColors.getX(i))
    .some(delta => delta > 0.05), 'cristais devem conservar a profundidade azul por vértice');
  const body = root.getObjectByName('Body').children.find(
    (object) => object.isSkinnedMesh && object.material.name === 'Ice_Base',
  );
  const boneNames = new Set();
  const joints = body.geometry.getAttribute('skinIndex');
  const weights = body.geometry.getAttribute('skinWeight');
  for (let i = 0; i < joints.count; i++) {
    for (let channel = 0; channel < 4; channel++) {
      if (weights.getComponent(i, channel) > 0.001) {
        boneNames.add(body.skeleton.bones[joints.getComponent(i, channel)].name);
      }
    }
  }
  assert.deepEqual([...boneNames].sort(), ['Chest', 'Pelvis', 'Spine']);
  assert.ok(Math.abs(box.getSize(new Vector3()).y - 4.5) < 0.05);
  assert.ok(Math.abs(box.min.y) < 0.05);
  for (const name of ['Beard', 'Shoulder_L', 'Shoulder_R', 'Back_Crystals',
    'Chest_Core', 'Chest_Plates', 'Chest_Fissures', 'Waist_Armor', 'Arm_Armor_L', 'Leg_Armor_L']) {
    assert.ok(root.getObjectByName(name), `${name} deve existir`);
  }
  for (const name of ['Head', 'Chest_Core']) {
    const mesh = root.getObjectByName(`${name}_Ice_Emission`);
    assert.ok(mesh?.isSkinnedMesh && mesh.material.name === 'Ice_Emission',
      `${name} deve usar o material emissivo`);
  }
  const fissures = root.getObjectByName('Chest_Fissures_Ice_Fissure');
  assert.ok(fissures?.isSkinnedMesh);
  assert.ok(fissures.material.emissiveIntensity <
    root.getObjectByName('Chest_Core_Ice_Emission').material.emissiveIntensity);
  assert.ok(root.getObjectByName('IceGolem_CoreLight')?.isPointLight);
  const center = root.localToWorld(new Vector3(0, 3.05, 2));
  const chestHit = new Raycaster(center, new Vector3(0, 0, -1), 0, 3)
    .intersectObject(root.getObjectByName('Body'), true);
  assert.ok(chestHit.length > 0, 'o esterno deve cobrir o centro do peito');
  for (const name of ['Body', 'Arm_L', 'Arm_R', 'Leg_L', 'Leg_R', 'Foot_L', 'Foot_R']) {
    const mesh = root.getObjectByName(`${name}_Ice_Base`);
    assert.equal(boundaryEdges(mesh.geometry), 0, `${name} não deve ter bordas abertas`);
  }
  const bodyGeometry = root.getObjectByName('Body').children[0].geometry;
  assert.ok(widthAtY(bodyGeometry, 3.19) > widthAtY(bodyGeometry, 1.90) * 1.8,
    'o peito deve ser muito mais largo que a cintura');
  const armGeometry = root.getObjectByName('Arm_L').children[0].geometry;
  assert.ok(widthAtY(armGeometry, 1.98) > widthAtY(armGeometry, 3.05) * 1.3,
    'o antebraço deve dominar o braço');
  const legGeometry = root.getObjectByName('Leg_L').children[0].geometry;
  assert.ok(widthAtY(legGeometry, .93) < widthAtY(legGeometry, 1.34) * .75,
    'o joelho deve ser mais estreito que a coxa');
});

test('rig do chefão coordena passada, contrabalanço e retorno ao repouso', async () => {
  const { scene } = await parseGameAsset();
  prepareBossGolemAsset(scene);
  const rig = createBossGolemRig(scene);
  const rest = Object.fromEntries(
    Object.entries(rig.restQuaternions).map(([name, quaternion]) => [name, quaternion.clone()]),
  );

  const pose = updateBossGolemPose(rig, { phase: Math.PI / 2, moving: true });
  assert.equal(pose.stride, 1);
  assert.ok(pose.verticalOffset < 0);
  assert.ok(rig.bones.UpperArm_L.quaternion.angleTo(rest.UpperArm_L) > 0.15);
  assert.ok(rig.bones.UpperArm_R.quaternion.angleTo(rest.UpperArm_R) > 0.15);
  assert.ok(rig.bones.UpperLeg_L.quaternion.angleTo(rest.UpperLeg_L) > 0.2);
  assert.ok(rig.bones.UpperLeg_R.quaternion.angleTo(rest.UpperLeg_R) > 0.2);
  assert.ok(rig.bones.LowerLeg_R.quaternion.angleTo(rest.LowerLeg_R) > 0.15);
  assert.ok(rig.bones.LowerLeg_L.quaternion.angleTo(rest.LowerLeg_L) < 1e-8);

  updateBossGolemPose(rig, { phase: Math.PI / 2, moving: false });
  for (const [name, bone] of Object.entries(rig.bones)) {
    assert.ok(bone.quaternion.angleTo(rest[name]) < 1e-6, `${name} não voltou ao repouso`);
  }
});

test('somente o chefão troca o visual procedural pelo GLB', async () => {
  const gltf = await parseGameAsset();
  const requested = [];
  const loader = {
    async loadAsync(url) {
      requested.push(url);
      return gltf;
    },
  };
  const enemy = new EnemySystem({ scene: new Scene(), bossAssetLoader: loader });
  assert.equal(enemy.visual.children.length, 17);
  assert.equal(requested.length, 0);

  enemy.reset({
    enemyType: GAMEPLAY_CONFIG.boss.type,
    moveSpeed: GAMEPLAY_CONFIG.boss.moveSpeed,
    radius: GAMEPLAY_CONFIG.boss.radius,
    visualScale: GAMEPLAY_CONFIG.boss.visualScale,
    spawnHeight: GAMEPLAY_CONFIG.boss.spawnHeight,
  });
  await enemy.bossAssetPromise;
  assert.deepEqual(requested, [BOSS_GOLEM_URL]);
  assert.equal(enemy.visual.children.length, 1);
  assert.equal(enemy.bossAsset.visible, true);

  enemy.reset({
    enemyType: GAMEPLAY_CONFIG.enemy.types[0],
    radius: GAMEPLAY_CONFIG.enemy.radius,
    visualScale: GAMEPLAY_CONFIG.enemy.types[0].visualScale,
    spawnHeight: GAMEPLAY_CONFIG.enemy.spawn.height,
  });
  assert.equal(enemy.bossAsset.visible, false);
  assert.equal(enemy.visual.children.length, 18);
  assert.equal(requested.length, 1);
  enemy.dispose();
});
