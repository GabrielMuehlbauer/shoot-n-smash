import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { Box3, Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import {
  BOSS_GOLEM_URL,
  prepareBossGolemAsset,
} from './BossGolemAsset.js';
import { EnemySystem } from './EnemySystem.js';

async function parseGameAsset() {
  const bytes = await readFile(new URL('../../public/assets/models/ice_golem.glb', import.meta.url));
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
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
  assert.ok(skinnedMeshes >= 20 && skinnedMeshes <= 60);
  assert.ok(triangles >= 80000 && triangles <= 100000, `${triangles} triângulos`);
  assert.deepEqual([...materials].sort(),
    ['Ice_Base', 'Ice_Dark', 'Ice_Emission', 'Ice_Light']);
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
