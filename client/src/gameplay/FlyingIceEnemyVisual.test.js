import assert from 'node:assert/strict';
import test from 'node:test';

import { FlyingIceEnemyVisual } from './FlyingIceEnemyVisual.js';

test('monta um alado de gelo otimizado com asas, fissuras e materiais nomeados', () => {
  const visual = new FlyingIceEnemyVisual();
  const materialNames = new Set(
    [...visual.materials].map((material) => material.name),
  );
  let triangleCount = 0;

  visual.root.traverse((object) => {
    if (!object.isMesh) return;
    const position = object.geometry.getAttribute('position');
    triangleCount += object.geometry.index
      ? object.geometry.index.count / 3
      : position.count / 3;
  });

  assert.deepEqual(materialNames, new Set([
    'Ice_Base',
    'Ice_Dark',
    'Ice_Crystal',
    'Ice_Emission',
  ]));
  assert.ok(visual.root.getObjectByName('flying-ice-left-wing'));
  assert.ok(visual.root.getObjectByName('flying-ice-right-wing'));
  assert.ok(visual.root.getObjectByName('flying-ice-emissive-fissures'));
  for (const pivotName of [
    'WingShoulder_L',
    'WingElbow_L',
    'WingTip_L',
    'WingShoulder_R',
    'WingElbow_R',
    'WingTip_R',
  ]) {
    assert.ok(visual.root.getObjectByName(pivotName), `faltando ${pivotName}`);
  }
  assert.ok(visual.root.getObjectByName('flying-ice-left-ear'));
  assert.ok(visual.root.getObjectByName('flying-ice-right-ear'));
  assert.ok(visual.root.getObjectByName('flying-ice-left-leg-claw-1'));
  assert.ok(visual.root.getObjectByName('flying-ice-right-leg-claw-3'));
  assert.ok(visual.root.getObjectByName('flying-ice-left-wing-finger-4'));
  assert.ok(visual.root.getObjectByName('flying-ice-right-wing-membrane-panel-4'));
  assert.ok(triangleCount < 1_500);

  visual.update({ elapsed: 0.2, state: 'dive', hitRatio: 1 });
  assert.notEqual(visual.leftWing.rotation.x, 0);
  assert.notEqual(visual.leftWingShoulder.rotation.z, 0);
  assert.notEqual(visual.leftWingElbow.rotation.z, 0);
  assert.notEqual(visual.leftWingTip.rotation.z, 0);
  assert.notEqual(visual.root.position.y, 0);
  assert.equal(visual.createProjectile().name, 'flying-ice-projectile');
  visual.dispose();
});
