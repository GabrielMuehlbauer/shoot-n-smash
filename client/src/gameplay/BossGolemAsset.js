import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const BOSS_GOLEM_URL = '/assets/models/ice_golem.glb';
export const BOSS_GOLEM_SOURCE_HEIGHT = 4.5;
export const BOSS_GOLEM_GAME_HEIGHT = 6.2;

const REQUIRED_PARTS = [
  'Body', 'Head', 'Beard', 'Horn_L', 'Horn_R', 'Shoulder_L',
  'Shoulder_R', 'Arm_L', 'Arm_R', 'Hand_L', 'Hand_R', 'Leg_L',
  'Leg_R', 'Foot_L', 'Foot_R', 'Back_Crystals', 'Arm_Crystals',
  'Leg_Crystals', 'Waist_Armor', 'Chest_Core',
];

export function disposeBossGolemAsset(scene) {
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

export function prepareBossGolemAsset(scene) {
  const root = scene?.getObjectByName?.('IceGolem_Root');
  const armature = root?.getObjectByName('IceGolem_Armature');
  if (!root || !armature) {
    throw new Error('O GLB do chefão está incompleto ou sem armature.');
  }
  const partNames = new Set();
  let skinnedMeshes = 0;
  armature.traverse((object) => {
    if (!object.isSkinnedMesh) return;
    skinnedMeshes += 1;
    // GLTFLoader adds a numeric suffix when a mesh and a bone share a name.
    const partName = object.parent === armature ? object.name : object.parent.name;
    partNames.add(partName.replace(/_\d+$/, ''));
  });
  if (skinnedMeshes === 0 || REQUIRED_PARTS.some((name) => !partNames.has(name))) {
    throw new Error('O GLB do chefão não contém todas as peças com skin.');
  }
  return scene;
}

export async function loadBossGolemAsset({ loader = new GLTFLoader() } = {}) {
  const { scene } = await loader.loadAsync(BOSS_GOLEM_URL);
  try {
    return prepareBossGolemAsset(scene);
  } catch (error) {
    if (scene) disposeBossGolemAsset(scene);
    throw error;
  }
}
