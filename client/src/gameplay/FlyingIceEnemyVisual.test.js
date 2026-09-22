import assert from 'node:assert/strict';
import test from 'node:test';

import { FlyingIceEnemyVisual } from './FlyingIceEnemyVisual.js';

test('monta um alado de gelo otimizado com asas, fissuras e materiais nomeados', () => {
  const visual = new FlyingIceEnemyVisual();
  const materialNames = new Set(
    [...visual.materials].map((material) => material.name),
  );
  let triangleCount = 0;

  for (const geometry of visual.geometries) {
    const position = geometry.getAttribute('position');
    triangleCount += geometry.index
      ? geometry.index.count / 3
      : position.count / 3;
  }

  assert.deepEqual(materialNames, new Set([
    'Ice_Base',
    'Ice_Dark',
    'Ice_Crystal',
    'Ice_Emission',
  ]));
  assert.ok(visual.root.getObjectByName('flying-ice-left-wing'));
  assert.ok(visual.root.getObjectByName('flying-ice-right-wing'));
  assert.ok(visual.root.getObjectByName('flying-ice-emissive-fissures'));
  assert.ok(triangleCount < 1_500);

  visual.update({ elapsed: 0.2, state: 'dive', hitRatio: 1 });
  assert.notEqual(visual.leftWing.rotation.x, 0);
  assert.equal(visual.createProjectile().name, 'flying-ice-projectile');
  visual.dispose();
});
