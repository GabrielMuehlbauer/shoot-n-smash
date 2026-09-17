import { Euler, PointLight, Quaternion } from 'three';
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

const RIG_BONES = [
  'Pelvis', 'Spine', 'Chest', 'Head',
  'UpperArm_L', 'LowerArm_L', 'Hand_L',
  'UpperArm_R', 'LowerArm_R', 'Hand_R',
  'UpperLeg_L', 'LowerLeg_L', 'Foot_L',
  'UpperLeg_R', 'LowerLeg_R', 'Foot_R',
];

const MATERIAL_TUNING = Object.freeze({
  Ice_Base: Object.freeze({ roughness: 0.3, metalness: 0.04, envMapIntensity: 1.2 }),
  Ice_Dark: Object.freeze({ roughness: 0.4, metalness: 0.02, envMapIntensity: 0.9 }),
  Ice_Light: Object.freeze({ roughness: 0.22, metalness: 0.03, envMapIntensity: 1.35 }),
  Ice_Emission: Object.freeze({ roughness: 0.24, metalness: 0, envMapIntensity: 1.1 }),
});

function tuneBossMaterials(root) {
  const materials = new Set();
  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
    for (const material of [object.material].flat().filter(Boolean)) {
      if (materials.has(material)) continue;
      materials.add(material);
      const tuning = MATERIAL_TUNING[material.name];
      if (!tuning) continue;
      Object.assign(material, tuning);
      if (material.name === 'Ice_Emission') {
        material.emissiveIntensity = 2.65;
      }
      material.needsUpdate = true;
    }
  });
}

function addChestCoreLight(root) {
  if (root.getObjectByName('IceGolem_CoreLight')) return;
  const light = new PointLight(0x35cfff, 1.45, 5.2, 2);
  light.name = 'IceGolem_CoreLight';
  light.position.set(0, 3.02, 0.46);
  light.castShadow = false;
  root.add(light);
}

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
  tuneBossMaterials(root);
  addChestCoreLight(root);
  return scene;
}

export function createBossGolemRig(scene) {
  const root = scene?.getObjectByName?.('IceGolem_Root');
  const armature = root?.getObjectByName('IceGolem_Armature');
  if (!root || !armature) {
    throw new Error('O GLB do chefão está incompleto ou sem armature.');
  }

  const bones = {};
  const restQuaternions = {};
  for (const name of RIG_BONES) {
    const bone = armature.getObjectByName(name);
    if (!bone?.isBone) {
      throw new Error(`O rig do chefão não contém o osso ${name}.`);
    }
    bones[name] = bone;
    restQuaternions[name] = bone.quaternion.clone().normalize();
    bone.quaternion.copy(restQuaternions[name]);
  }

  const emissiveMaterials = new Set();
  root.traverse((object) => {
    for (const material of [object.material].flat().filter(Boolean)) {
      if (material.name === 'Ice_Emission') emissiveMaterials.add(material);
    }
  });

  return {
    bones,
    coreLight: root.getObjectByName('IceGolem_CoreLight') ?? null,
    emissiveMaterials: [...emissiveMaterials],
    restQuaternions,
    rotation: new Euler(0, 0, 0, 'XYZ'),
    deltaQuaternion: new Quaternion(),
  };
}

function poseBone(rig, name, x = 0, y = 0, z = 0) {
  rig.rotation.set(x, y, z);
  rig.deltaQuaternion.setFromEuler(rig.rotation);
  rig.bones[name].quaternion
    .copy(rig.deltaQuaternion)
    .multiply(rig.restQuaternions[name]);
}

export function updateBossGolemPose(rig, { phase = 0, moving = false } = {}) {
  if (!rig?.bones || !Number.isFinite(phase)) {
    throw new TypeError('Pose do chefão requer um rig e uma fase válidos.');
  }

  const stride = moving ? Math.sin(phase) : 0;
  const leftLift = moving ? Math.max(0, -stride) : 0;
  const rightLift = moving ? Math.max(0, stride) : 0;
  const bodyLean = moving ? 0.035 : 0;

  // Quadril e ombros giram em oposição para sustentar o peso do torso.
  poseBone(rig, 'Pelvis', bodyLean, stride * 0.035);
  poseBone(rig, 'Spine', bodyLean * 0.45, -stride * 0.025);
  poseBone(rig, 'Chest', bodyLean * 0.35, -stride * 0.045);
  poseBone(rig, 'Head', -bodyLean * 0.8, stride * 0.018);

  // Os braços contrabalançam as pernas; cotovelos e mãos atrasam o gesto.
  poseBone(rig, 'UpperArm_L', stride * 0.2, 0, -stride * 0.018);
  poseBone(rig, 'LowerArm_L', stride * 0.075 + leftLift * 0.04);
  poseBone(rig, 'Hand_L', -stride * 0.045);
  poseBone(rig, 'UpperArm_R', -stride * 0.2, 0, -stride * 0.018);
  poseBone(rig, 'LowerArm_R', -stride * 0.075 + rightLift * 0.04);
  poseBone(rig, 'Hand_R', stride * 0.045);

  // O joelho dobra na fase aérea e o pé compensa para permanecer nivelado.
  poseBone(rig, 'UpperLeg_L', -stride * 0.24, stride * 0.012);
  poseBone(rig, 'LowerLeg_L', leftLift * 0.2);
  poseBone(rig, 'Foot_L', stride * 0.12 - leftLift * 0.08);
  poseBone(rig, 'UpperLeg_R', stride * 0.24, -stride * 0.012);
  poseBone(rig, 'LowerLeg_R', rightLift * 0.2);
  poseBone(rig, 'Foot_R', -stride * 0.12 - rightLift * 0.08);

  const corePulse = 0.5 + 0.5 * Math.sin(phase * 2);
  if (rig.coreLight) rig.coreLight.intensity = 1.35 + corePulse * 0.28;
  for (const material of rig.emissiveMaterials) {
    material.emissiveIntensity = 2.45 + corePulse * 0.4;
  }

  return {
    stride,
    verticalOffset: moving ? -0.045 * (1 - Math.cos(phase * 2)) * 0.5 : 0,
  };
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
