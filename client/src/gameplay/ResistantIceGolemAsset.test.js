import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { Box3, Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { EnemySystem } from './EnemySystem.js';
import {
  prepareResistantGolemAsset,
  RESISTANT_GOLEM_GAME_HEIGHT,
  RESISTANT_GOLEM_SOURCE_HEIGHT,
  RESISTANT_GOLEM_URL,
} from './ResistantGolemAsset.js';

const REQUIRED_PARTS = [
  'Body', 'Head', 'Beard', 'Horn_L', 'Horn_R', 'Shoulder_L',
  'Shoulder_R', 'Arm_L', 'Arm_R', 'Hand_L', 'Hand_R', 'Leg_L',
  'Leg_R', 'Foot_L', 'Foot_R', 'Back_Crystals', 'Arm_Crystals',
  'Leg_Crystals', 'Waist_Armor', 'Chest_Core',
];

const REQUIRED_BONES = [
  'Root', 'Pelvis', 'Spine', 'Chest', 'Neck', 'Head',
  'UpperArm_L', 'LowerArm_L', 'Hand_L',
  'UpperArm_R', 'LowerArm_R', 'Hand_R',
  'UpperLeg_L', 'LowerLeg_L', 'Foot_L',
  'UpperLeg_R', 'LowerLeg_R', 'Foot_R',
];

async function parseResistantAsset() {
  const bytes = await readFile(
    new URL('../../public/assets/models/ice_golem_resistant.glb', import.meta.url),
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  return { bytes, gltf };
}

test('GLB do monstro 3 preserva anatomia, rig e orçamento web', async () => {
  const { bytes, gltf: { scene } } = await parseResistantAsset();
  prepareResistantGolemAsset(scene);
  const root = scene.getObjectByName('IceGolem_Root');
  const armature = root?.getObjectByName('IceGolem_Armature');
  assert.ok(root && armature, 'raiz ou armature ausente');

  const parts = new Set();
  const bones = new Set();
  const materials = new Set();
  let triangles = 0;
  armature.traverse((object) => {
    if (!object.isSkinnedMesh) return;
    const index = object.geometry.index;
    triangles += index ? index.count / 3 : object.geometry.attributes.position.count / 3;
    parts.add((object.parent === armature ? object.name : object.parent.name).replace(/_\d+$/, ''));
    object.skeleton.bones.forEach((bone) => bones.add(bone.name));
    for (const material of [object.material].flat().filter(Boolean)) {
      materials.add(material.name);
    }
  });

  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  assert.ok(REQUIRED_PARTS.every((name) => parts.has(name)));
  assert.ok(REQUIRED_BONES.every((name) => bones.has(name)));
  assert.deepEqual([...materials].sort(),
    ['Ice_Base', 'Ice_Dark', 'Ice_Emission', 'Ice_Light']);
  assert.ok(triangles >= 100000 && triangles <= 120000, `${triangles} triângulos`);
  assert.ok(Math.abs(size.y - 4.5) < 0.05, `${size.y} unidades de altura`);
  assert.ok(Math.abs(bounds.min.y) < 0.05, `piso em ${bounds.min.y}`);
  assert.ok(bytes.byteLength < 6 * 1024 * 1024, `${bytes.byteLength} bytes`);
});

test('somente o inimigo resistente usa o modelo do monstro 3', async () => {
  const { gltf } = await parseResistantAsset();
  const requested = [];
  const loader = {
    async loadAsync(url) {
      requested.push(url);
      return gltf;
    },
  };
  const resistantType = GAMEPLAY_CONFIG.enemy.types.find(({ id }) => id === 'resistant');
  const enemy = new EnemySystem({
    scene: new Scene(),
    typeIds: ['resistant'],
    random: () => 0,
    typeRandom: () => 0,
    bossAssetLoader: null,
    weakAssetLoader: null,
    mediumAssetLoader: null,
    resistantAssetLoader: loader,
  });
  assert.equal(enemy.visual.children.length, 17);
  await enemy.resistantAssetPromise;

  assert.deepEqual(requested, [RESISTANT_GOLEM_URL]);
  assert.equal(enemy.visual.children.length, 1);
  assert.equal(enemy.resistantAsset.visible, true);
  assert.equal(
    enemy.resistantAsset.scale.x,
    RESISTANT_GOLEM_GAME_HEIGHT /
      (RESISTANT_GOLEM_SOURCE_HEIGHT * resistantType.visualScale),
  );

  const mediumType = GAMEPLAY_CONFIG.enemy.types.find(({ id }) => id === 'medium');
  enemy.reset({
    enemyType: mediumType,
    radius: GAMEPLAY_CONFIG.enemy.radius,
    visualScale: mediumType.visualScale,
    spawnHeight: GAMEPLAY_CONFIG.enemy.spawn.height,
  });
  assert.equal(enemy.resistantAsset.visible, false);
  assert.equal(enemy.visual.children.length, 18);

  enemy.reset({
    enemyType: resistantType,
    radius: GAMEPLAY_CONFIG.enemy.radius,
    visualScale: resistantType.visualScale,
    spawnHeight: GAMEPLAY_CONFIG.enemy.spawn.height,
  });
  assert.equal(enemy.resistantAsset.visible, true);
  assert.equal(enemy.visual.children.length, 1);
  assert.equal(requested.length, 1);
  enemy.dispose();
});
