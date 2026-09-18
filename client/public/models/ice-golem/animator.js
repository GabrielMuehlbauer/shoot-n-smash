// Runtime animation for the approved GLB. Three is injected so this module works
// both in the standalone preview and in a game bundle without a second copy.
export const ICE_GOLEM_ANIMATION_DURATIONS = Object.freeze({
  IDLE: 4.0,
  WALK: 2.4,
  ATTACK_HEAVY: 2.0,
  ATTACK_SLAM: 2.2,
  HIT: 0.55,
  DEATH: 3.0,
});

const ALIASES = Object.freeze({
  Forearm_L: 'LowerArm_L', Forearm_R: 'LowerArm_R',
  Thigh_L: 'UpperLeg_L', Thigh_R: 'UpperLeg_R',
  Shin_L: 'LowerLeg_L', Shin_R: 'LowerLeg_R',
});
const PARENTS = Object.freeze({
  Pelvis: 'Root', Spine: 'Pelvis', Chest: 'Spine', Neck: 'Chest', Head: 'Neck',
  UpperArm_L: 'Chest', LowerArm_L: 'UpperArm_L', Hand_L: 'LowerArm_L',
  UpperArm_R: 'Chest', LowerArm_R: 'UpperArm_R', Hand_R: 'LowerArm_R',
  UpperLeg_L: 'Pelvis', LowerLeg_L: 'UpperLeg_L', Foot_L: 'LowerLeg_L',
  UpperLeg_R: 'Pelvis', LowerLeg_R: 'UpperLeg_R', Foot_R: 'LowerLeg_R',
});
const ANIMATED_BONES = [
  'Root', 'Pelvis', 'Spine', 'Chest', 'Head',
  'UpperArm_L', 'LowerArm_L', 'Hand_L',
  'UpperArm_R', 'LowerArm_R', 'Hand_R',
  'UpperLeg_L', 'LowerLeg_L', 'Foot_L',
  'UpperLeg_R', 'LowerLeg_R', 'Foot_R',
];
const POSITION_BONES = ['Root', 'Pelvis', 'Spine', 'Chest'];
const frame = (time, rotations = {}, positions = {}) => ({ time, rotations, positions });

const POSES = Object.freeze({
  IDLE: [
    frame(0),
    frame(1, { Chest: [.012, 0, 0], Head: [.006, -.012, 0],
      UpperArm_L: [0, 0, -.014], UpperArm_R: [0, 0, .014],
      Hand_L: [.010, 0, 0], Hand_R: [.010, 0, 0] },
    { Chest: [0, .016, 0], Spine: [0, .004, 0] }),
    frame(2, { Spine: [.004, 0, 0], Head: [0, .012, 0] }, { Chest: [0, .005, 0] }),
    frame(3, { Chest: [.010, 0, 0], Head: [-.005, -.010, 0],
      UpperArm_L: [0, 0, -.012], UpperArm_R: [0, 0, .012] },
    { Chest: [0, .014, 0], Spine: [0, .003, 0] }),
    frame(4),
  ],
  WALK: [
    frame(0, { Pelvis: [.025, 0, 0], Chest: [.015, 0, 0],
      UpperLeg_L: [-.22, 0, 0], UpperLeg_R: [.22, 0, 0],
      LowerLeg_L: [.07, 0, 0], LowerLeg_R: [.18, 0, 0],
      Foot_L: [.06, 0, 0], Foot_R: [-.09, 0, 0],
      UpperArm_L: [.065, 0, 0], UpperArm_R: [-.065, 0, 0] }),
    frame(.6, { Pelvis: [.035, 0, 0], Chest: [.018, 0, 0],
      UpperLeg_L: [0, 0, 0], UpperLeg_R: [0, 0, 0],
      LowerLeg_L: [.10, 0, 0], LowerLeg_R: [.08, 0, 0] },
    { Pelvis: [0, -.028, 0] }),
    frame(1.2, { Pelvis: [.025, 0, 0], Chest: [.015, 0, 0],
      UpperLeg_L: [.22, 0, 0], UpperLeg_R: [-.22, 0, 0],
      LowerLeg_L: [.18, 0, 0], LowerLeg_R: [.07, 0, 0],
      Foot_L: [-.09, 0, 0], Foot_R: [.06, 0, 0],
      UpperArm_L: [-.065, 0, 0], UpperArm_R: [.065, 0, 0] }),
    frame(1.8, { Pelvis: [.035, 0, 0], Chest: [.018, 0, 0],
      LowerLeg_L: [.08, 0, 0], LowerLeg_R: [.10, 0, 0] },
    { Pelvis: [0, -.028, 0] }),
    frame(2.4, { Pelvis: [.025, 0, 0], Chest: [.015, 0, 0],
      UpperLeg_L: [-.22, 0, 0], UpperLeg_R: [.22, 0, 0],
      LowerLeg_L: [.07, 0, 0], LowerLeg_R: [.18, 0, 0],
      Foot_L: [.06, 0, 0], Foot_R: [-.09, 0, 0],
      UpperArm_L: [.065, 0, 0], UpperArm_R: [-.065, 0, 0] }),
  ],
  ATTACK_HEAVY: [
    frame(0),
    frame(.35, { Pelvis: [-.035, 0, 0], Chest: [-.10, 0, 0],
      UpperArm_R: [-.35, 0, .55], LowerArm_R: [-.42, 0, 0] }),
    frame(.82, { Chest: [-.13, 0, 0], UpperArm_R: [-.55, 0, 1.05],
      LowerArm_R: [-.78, 0, 0], Hand_R: [.14, 0, 0] }),
    frame(1.15, { Pelvis: [.09, 0, 0], Spine: [.17, 0, 0], Chest: [.29, 0, 0],
      UpperArm_R: [-1.00, 0, .22], LowerArm_R: [.20, 0, 0], Head: [-.07, 0, 0] },
    { Chest: [0, -.035, 0] }),
    frame(1.43, { Pelvis: [.06, 0, 0], Chest: [.18, 0, 0],
      UpperArm_R: [-.65, 0, .14], LowerArm_R: [.15, 0, 0] }),
    frame(2),
  ],
  ATTACK_SLAM: [
    frame(0),
    frame(.45, { Pelvis: [-.05, 0, 0], Chest: [-.10, 0, 0],
      UpperArm_L: [-.35, 0, -.70], UpperArm_R: [-.35, 0, .70],
      LowerArm_L: [-.40, 0, 0], LowerArm_R: [-.40, 0, 0] }),
    frame(.98, { Chest: [-.18, 0, 0],
      UpperArm_L: [-.65, 0, -1.00], UpperArm_R: [-.65, 0, 1.00],
      LowerArm_L: [-.65, 0, 0], LowerArm_R: [-.65, 0, 0] }),
    frame(1.34, { Pelvis: [.17, 0, 0], Spine: [.24, 0, 0], Chest: [.43, 0, 0],
      UpperArm_L: [-1.05, 0, -.22], UpperArm_R: [-1.05, 0, .22],
      LowerLeg_L: [.20, 0, 0], LowerLeg_R: [.20, 0, 0] },
    { Pelvis: [0, -.085, 0], Chest: [0, -.045, 0] }),
    frame(1.70, { Pelvis: [.09, 0, 0], Chest: [.23, 0, 0],
      UpperArm_L: [-.60, 0, -.16], UpperArm_R: [-.60, 0, .16] },
    { Pelvis: [0, -.035, 0] }),
    frame(2.2),
  ],
  HIT: [
    frame(0),
    frame(.13, { Spine: [-.075, 0, 0], Chest: [-.12, 0, 0], Head: [.06, 0, 0],
      UpperArm_L: [.04, 0, 0], UpperArm_R: [.04, 0, 0] }),
    frame(.30, { Spine: [-.035, 0, 0], Chest: [-.06, 0, 0] }),
    frame(.55),
  ],
  DEATH: [
    frame(0),
    frame(.7, { Pelvis: [.08, 0, 0], Spine: [.12, 0, 0], Chest: [.15, 0, 0],
      LowerLeg_L: [.10, 0, 0], LowerLeg_R: [.10, 0, 0] },
    { Root: [0, -.07, 0] }),
    frame(1.6, { Pelvis: [.22, 0, 0], Spine: [.32, 0, 0], Chest: [.40, 0, 0],
      Head: [-.10, 0, 0], UpperLeg_L: [-.16, 0, 0], UpperLeg_R: [-.16, 0, 0],
      LowerLeg_L: [.38, 0, 0], LowerLeg_R: [.38, 0, 0] },
    { Root: [0, -.26, 0] }),
    frame(2.3, { Pelvis: [.30, 0, 0], Spine: [.45, 0, 0], Chest: [.56, 0, 0],
      Head: [-.18, 0, 0], UpperArm_L: [-.22, 0, -.25], UpperArm_R: [-.22, 0, .25],
      LowerLeg_L: [.62, 0, 0], LowerLeg_R: [.62, 0, 0] },
    { Root: [0, -.52, 0] }),
    frame(3, { Pelvis: [.33, 0, 0], Spine: [.48, 0, 0], Chest: [.60, 0, 0],
      Head: [-.22, 0, 0], UpperArm_L: [-.24, 0, -.27], UpperArm_R: [-.24, 0, .27],
      LowerLeg_L: [.68, 0, 0], LowerLeg_R: [.68, 0, 0] },
    { Root: [0, -.60, 0] }),
  ],
});

const CLIP_NAMES = Object.freeze({
  IDLE: 'IceGolem_Idle', WALK: 'IceGolem_Walk',
  ATTACK_HEAVY: 'IceGolem_Attack_Heavy', ATTACK_SLAM: 'IceGolem_Attack_Slam',
  HIT: 'IceGolem_Hit', DEATH: 'IceGolem_Death',
});
const MARKERS = Object.freeze({
  WALK: [{ time: .06, name: 'LeftFootImpact' }, { time: 1.26, name: 'RightFootImpact' }],
  ATTACK_HEAVY: [{ time: 1.15, name: 'AttackImpact' }],
  ATTACK_SLAM: [{ time: 1.34, name: 'GroundSlamImpact' }],
  DEATH: [{ time: 2.3, name: 'DeathImpact' }],
});
const EMPTY_MARKERS = Object.freeze([]);

function validateRig(model) {
  const bones = {};
  for (const name of ['Root', ...Object.keys(PARENTS)]) {
    const bone = model.getObjectByName(name);
    if (!bone?.isBone) throw new Error(`Ice Golem bone missing: ${name}`);
    bones[name] = bone;
  }
  for (const [name, parent] of Object.entries(PARENTS)) {
    if (bones[name].parent !== bones[parent]) {
      throw new Error(`Ice Golem bone ${name} must be a child of ${parent}`);
    }
  }
  let meshes = 0;
  model.traverse(object => {
    if (!object.isSkinnedMesh) return;
    meshes++;
    const indices = object.geometry.getAttribute('skinIndex');
    const weights = object.geometry.getAttribute('skinWeight');
    if (indices?.itemSize !== 4 || weights?.itemSize !== 4 || indices.count !== weights.count) {
      throw new Error(`Invalid skin attributes on ${object.name}`);
    }
    for (let i = 0; i < weights.count; i++) {
      let sum = 0;
      for (let channel = 0; channel < 4; channel++) {
        const weight = weights.getComponent(i, channel);
        const index = indices.getComponent(i, channel);
        if (!Number.isFinite(weight) || weight < 0 || index >= object.skeleton.bones.length) {
          throw new Error(`Invalid skin influence on ${object.name}`);
        }
        sum += weight;
      }
      if (Math.abs(sum - 1) > .002) throw new Error(`Unnormalized skin weights on ${object.name}`);
    }
  });
  if (!meshes) throw new Error('Ice Golem has no skinned meshes');
  for (const [alias, actual] of Object.entries(ALIASES)) bones[alias] = bones[actual];
  return bones;
}

function makeClip(THREE, state, bones, rest) {
  const frames = POSES[state];
  const times = frames.map(value => value.time);
  const tracks = [];
  const euler = new THREE.Euler();
  const delta = new THREE.Quaternion();
  const pose = new THREE.Quaternion();
  for (const name of ANIMATED_BONES) {
    const values = [];
    for (const key of frames) {
      const angles = key.rotations[name] ?? [0, 0, 0];
      euler.set(angles[0], angles[1], angles[2], 'XYZ');
      delta.setFromEuler(euler);
      pose.copy(rest[name].quaternion).multiply(delta);
      values.push(pose.x, pose.y, pose.z, pose.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bones[name].name}.quaternion`, times, values));
  }
  for (const name of POSITION_BONES) {
    const values = [];
    for (const key of frames) {
      const offset = key.positions[name] ?? [0, 0, 0];
      const position = rest[name].position;
      values.push(position.x + offset[0], position.y + offset[1], position.z + offset[2]);
    }
    tracks.push(new THREE.VectorKeyframeTrack(`${bones[name].name}.position`, times, values));
  }
  return new THREE.AnimationClip(CLIP_NAMES[state], ICE_GOLEM_ANIMATION_DURATIONS[state], tracks);
}

export function createIceGolemAnimator(model, THREE, { onEvent = () => {} } = {}) {
  if (!model?.getObjectByName || !THREE?.AnimationMixer || typeof onEvent !== 'function') {
    throw new TypeError('Ice Golem animation needs a loaded model, Three.js and an event callback');
  }
  const bones = validateRig(model);
  const rest = {};
  for (const name of ANIMATED_BONES) {
    rest[name] = { quaternion: bones[name].quaternion.clone(), position: bones[name].position.clone() };
  }
  const mixer = new THREE.AnimationMixer(model);
  const clips = {};
  const actions = {};
  for (const state of Object.keys(POSES)) {
    const clip = makeClip(THREE, state, bones, rest);
    clip.userData = { markers: MARKERS[state] ?? EMPTY_MARKERS };
    const action = mixer.clipAction(clip);
    action.setLoop(state === 'IDLE' || state === 'WALK' ? THREE.LoopRepeat : THREE.LoopOnce,
      state === 'IDLE' || state === 'WALK' ? Infinity : 1);
    action.clampWhenFinished = state !== 'IDLE' && state !== 'WALK';
    clips[state] = clip;
    actions[state] = action;
  }

  const coreMesh = model.getObjectByName('Chest_Core_Ice_Emission');
  const eyeMesh = model.getObjectByName('Head_Ice_Emission');
  if (!coreMesh?.isMesh || !eyeMesh?.isMesh) throw new Error('Ice Golem emissive parts missing');
  const originalCore = coreMesh.material;
  const originalEyes = eyeMesh.material;
  coreMesh.material = originalCore.clone();
  eyeMesh.material = originalEyes.clone();
  const animatedCore = coreMesh.material;
  const animatedEyes = eyeMesh.material;
  const fissureMaterials = new Set();
  model.traverse(object => {
    if (object.isMesh && object.material?.name === 'Ice_Fissure') fissureMaterials.add(object.material);
  });
  const originalFissures = new Map([...fissureMaterials].map(material =>
    [material, material.emissiveIntensity]));

  let state = null;
  let elapsed = 0;
  let energyTime = 0;
  let disposed = false;
  let returnState = 'IDLE';

  function play(next) {
    if (disposed || (state === 'DEATH' && next !== 'DEATH')) return false;
    if (state === next) return true;
    if (next === 'HIT') returnState = state === 'WALK' ? 'WALK' : 'IDLE';
    const previous = state && actions[state];
    const action = actions[next];
    const fade = next === 'DEATH' ? .25
      : next === 'HIT' ? .10
        : state === 'WALK' && next.startsWith('ATTACK') ? .15
          : state?.startsWith('ATTACK') ? .20 : .25;
    action.reset();
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.play();
    if (previous) previous.crossFadeTo(action, fade, false);
    state = next;
    elapsed = 0;
    return true;
  }

  function emitMarkers(previous, current) {
    for (const marker of MARKERS[state] ?? EMPTY_MARKERS) {
      const duration = ICE_GOLEM_ANIMATION_DURATIONS[state];
      const count = state === 'WALK'
        ? Math.floor((current - marker.time) / duration)
          - Math.floor((previous - marker.time) / duration)
        : previous < marker.time && current >= marker.time ? 1 : 0;
      for (let i = 0; i < count; i++) onEvent(marker.name);
    }
  }

  const api = {
    bones, clips, actions, mixer, rest, markers: MARKERS,
    get state() { return state; },
    playIdle: () => play('IDLE'),
    playWalk: () => play('WALK'),
    playAttackHeavy: () => play('ATTACK_HEAVY'),
    playAttackSlam: () => play('ATTACK_SLAM'),
    playHit: () => play('HIT'),
    playDeath: () => play('DEATH'),
    update(deltaSeconds) {
      if (disposed) return;
      if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
        throw new RangeError('Ice Golem delta must be finite and nonnegative');
      }
      const previous = elapsed;
      elapsed += deltaSeconds;
      energyTime += deltaSeconds;
      emitMarkers(previous, elapsed);
      mixer.update(deltaSeconds);
      const pulse = .5 + .5 * Math.sin(energyTime * Math.PI / 2);
      const fade = state === 'DEATH' ? Math.max(0, 1 - elapsed / 3) : 1;
      coreMesh.material.emissiveIntensity = (1.02 + .15 * pulse) * fade;
      eyeMesh.material.emissiveIntensity = (1.10 + .025 * pulse) * fade;
      for (const material of fissureMaterials) material.emissiveIntensity = (.50 + .07 * pulse) * fade;
      if (state === 'HIT' && elapsed >= ICE_GOLEM_ANIMATION_DURATIONS.HIT) play(returnState);
      else if ((state === 'ATTACK_HEAVY' || state === 'ATTACK_SLAM')
        && elapsed >= ICE_GOLEM_ANIMATION_DURATIONS[state]) play('IDLE');
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      for (const name of ANIMATED_BONES) {
        bones[name].quaternion.copy(rest[name].quaternion);
        bones[name].position.copy(rest[name].position);
      }
      coreMesh.material = originalCore;
      eyeMesh.material = originalEyes;
      animatedCore.dispose();
      animatedEyes.dispose();
      for (const [material, intensity] of originalFissures) material.emissiveIntensity = intensity;
    },
  };
  play('IDLE');
  return api;
}
