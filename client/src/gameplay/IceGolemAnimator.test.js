import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  createIceGolemAnimator,
  ICE_GOLEM_ANIMATION_DURATIONS,
} from '../../public/models/ice-golem/animator.js';

async function loadModel() {
  const bytes = await readFile(new URL('../../public/models/ice-golem/ice_golem.glb', import.meta.url));
  return (await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
  )).scene;
}

test('rig mantém hierarquia, quatro influências e clipes com os nomes e durações esperados', async () => {
  const scene = await loadModel();
  const golem = createIceGolemAnimator(scene, THREE);
  assert.equal(golem.bones.Forearm_L, golem.bones.LowerArm_L);
  assert.equal(golem.bones.Thigh_R, golem.bones.UpperLeg_R);
  assert.equal(golem.bones.Shin_L, golem.bones.LowerLeg_L);
  assert.deepEqual(Object.keys(golem.clips), Object.keys(ICE_GOLEM_ANIMATION_DURATIONS));
  for (const [state, duration] of Object.entries(ICE_GOLEM_ANIMATION_DURATIONS)) {
    assert.equal(golem.clips[state].duration, duration);
    assert.ok(golem.clips[state].tracks.some(track => track instanceof THREE.QuaternionKeyframeTrack));
    assert.ok(golem.clips[state].tracks.some(track => track instanceof THREE.VectorKeyframeTrack));
  }
  assert.deepEqual(golem.clips.WALK.userData.markers.map(marker => marker.name),
    ['LeftFootImpact', 'RightFootImpact']);
  assert.deepEqual(golem.clips.ATTACK_HEAVY.userData.markers.map(marker => marker.name),
    ['AttackImpact']);
  assert.deepEqual(golem.clips.ATTACK_SLAM.userData.markers.map(marker => marker.name),
    ['GroundSlamImpact']);
  assert.deepEqual(golem.clips.DEATH.userData.markers.map(marker => marker.name),
    ['DeathImpact']);
  for (const part of ['Shoulder_L_Ice_Crystal', 'Back_Crystals_Ice_Crystal',
    'Beard_Ice_Crystal', 'Horn_L_Ice_Crystal', 'Arm_Armor_L_Ice_Crystal',
    'Leg_Armor_L_Ice_Crystal']) {
    const mesh = scene.getObjectByName(part);
    assert.ok(mesh?.isSkinnedMesh, `${part}: skinned mesh missing`);
    const weights = mesh.geometry.getAttribute('skinWeight');
    for (let i = 0; i < weights.count; i++) {
      const influences = [0, 1, 2, 3]
        .filter(channel => weights.getComponent(i, channel) > .001).length;
      assert.equal(influences, 1, `${part}: crystal should stay rigid`);
    }
  }
  for (const name of ['UpperArm_L', 'UpperArm_R', 'Forearm_L', 'Forearm_R',
    'Thigh_L', 'Thigh_R', 'Shin_L', 'Shin_R', 'Head']) {
    const bone = golem.bones[name];
    const rest = bone.quaternion.clone();
    bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.25, 0, 0)));
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    assert.ok(bounds.min.toArray().every(Number.isFinite), `${name}: bounds min`);
    assert.ok(bounds.max.toArray().every(Number.isFinite), `${name}: bounds max`);
    assert.ok(bounds.getSize(new THREE.Vector3()).length() < 9, `${name}: mesh separated`);
    bone.quaternion.copy(rest);
  }
  assert.equal(golem.state, 'IDLE');
  golem.dispose();
});

test('idle, marcha, ataques, hit e death animam bones e emitem impactos sem trocar geometria', async () => {
  const scene = await loadModel();
  const events = [];
  const golem = createIceGolemAnimator(scene, THREE, { onEvent: name => events.push(name) });
  const body = scene.getObjectByName('Body_Ice_Base');
  const positions = body.geometry.getAttribute('position');
  const restChestY = golem.rest.Chest.position.y;

  golem.update(1);
  assert.ok(golem.bones.Chest.position.y > restChestY);
  assert.ok(scene.getObjectByName('Chest_Core_Ice_Emission').material.emissiveIntensity >
    scene.getObjectByName('Head_Ice_Emission').material.emissiveIntensity - .1);

  golem.playWalk();
  golem.update(.1);
  golem.update(1.2);
  assert.deepEqual(events.slice(0, 2), ['LeftFootImpact', 'RightFootImpact']);
  assert.ok(golem.bones.UpperLeg_L.quaternion.angleTo(golem.rest.UpperLeg_L.quaternion) > .01);

  golem.playAttackHeavy();
  golem.update(1.16);
  assert.ok(events.includes('AttackImpact'));
  golem.update(.85);
  assert.equal(golem.state, 'IDLE');

  golem.playAttackSlam();
  golem.update(1.35);
  assert.ok(events.includes('GroundSlamImpact'));
  golem.update(.86);
  assert.equal(golem.state, 'IDLE');

  golem.playHit();
  golem.update(.56);
  assert.equal(golem.state, 'IDLE');

  golem.playDeath();
  golem.update(2.31);
  assert.ok(events.includes('DeathImpact'));
  assert.equal(golem.playWalk(), false);
  golem.update(.69);
  assert.equal(golem.state, 'DEATH');
  assert.ok(golem.bones.Root.position.y < golem.rest.Root.position.y - .5);
  assert.equal(body.geometry.getAttribute('position'), positions);
  golem.dispose();
  assert.equal(body.geometry.getAttribute('position'), positions);
});
