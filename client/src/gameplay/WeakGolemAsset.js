import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { createBossGolemRig } from './BossGolemAsset.js';

export const WEAK_GOLEM_URL = '/assets/models/ice_golem_weak.glb';
export const WEAK_GOLEM_SOURCE_HEIGHT = 4.5;
export const WEAK_GOLEM_GAME_HEIGHT = 2.1;

const REQUIRED_PARTS = [
  'Body', 'Head', 'Beard', 'Horn_L', 'Horn_R', 'Shoulder_L',
  'Shoulder_R', 'Arm_L', 'Arm_R', 'Hand_L', 'Hand_R', 'Leg_L',
  'Leg_R', 'Foot_L', 'Foot_R', 'Back_Crystals', 'Arm_Crystals',
  'Leg_Crystals', 'Waist_Armor', 'Chest_Core',
];

export function disposeWeakGolemAsset(scene) {
  const geometries = new Set();
  const materials = new Set();
  scene.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) {
      materials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

export function prepareWeakGolemAsset(scene) {
  const root = scene?.getObjectByName?.('IceGolem_Root');
  const armature = root?.getObjectByName('IceGolem_Armature');
  if (!root || !armature) {
    throw new Error('O GLB do golem fraco está incompleto ou sem armature.');
  }

  const partNames = new Set();
  let skinnedMeshes = 0;
  armature.traverse((object) => {
    if (!object.isSkinnedMesh) return;
    skinnedMeshes += 1;
    const partName = object.parent === armature ? object.name : object.parent.name;
    partNames.add(partName.replace(/_\d+$/, ''));
    object.castShadow = true;
    object.receiveShadow = true;
    for (const material of [object.material].flat().filter(Boolean)) {
      material.envMapIntensity = material.name === 'Ice_Dark' ? 0.9 : 1.2;
      if (material.name === 'Ice_Emission') material.emissiveIntensity = 2.1;
    }
  });
  if (skinnedMeshes === 0 || REQUIRED_PARTS.some((name) => !partNames.has(name))) {
    throw new Error('O GLB do golem fraco não contém todas as peças com skin.');
  }
  return scene;
}

export function createWeakGolemRig(scene) {
  return createBossGolemRig(scene);
}

export async function loadWeakGolemAsset({ loader = new GLTFLoader() } = {}) {
  const { scene } = await loader.loadAsync(WEAK_GOLEM_URL);
  try {
    return prepareWeakGolemAsset(scene);
  } catch (error) {
    if (scene) disposeWeakGolemAsset(scene);
    throw error;
  }
}
