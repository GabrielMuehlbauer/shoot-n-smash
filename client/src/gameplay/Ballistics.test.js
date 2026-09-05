import assert from 'node:assert/strict';
import test from 'node:test';

import { Vector3 } from 'three';

import {
  calculateBallisticPoint,
  integrateBallisticStep,
} from './Ballistics.js';

function assertVectorAlmostEqual(actual, expected, tolerance = 1e-10) {
  assert.ok(actual.distanceTo(expected) <= tolerance);
}

test('calcula posição prevista com velocidade e gravidade', () => {
  const point = calculateBallisticPoint({
    origin: new Vector3(1, 2, 3),
    velocity: new Vector3(4, 5, -6),
    gravity: -10,
    timeSeconds: 0.5,
  });

  assertVectorAlmostEqual(point, new Vector3(3, 3.25, 0));
});

test('integração por passos coincide com a previsão analítica', () => {
  const origin = new Vector3(0, 1.4, 0);
  const initialVelocity = new Vector3(1, 3, -12);
  const expected = calculateBallisticPoint({
    origin,
    velocity: initialVelocity,
    gravity: -9.8,
    timeSeconds: 1,
  });
  const position = origin.clone();
  const velocity = initialVelocity.clone();

  for (let step = 0; step < 10; step += 1) {
    integrateBallisticStep({
      position,
      velocity,
      gravity: -9.8,
      deltaSeconds: 0.1,
    });
  }

  assertVectorAlmostEqual(position, expected);
});

test('rejeita vetores, gravidade e tempos inválidos', () => {
  assert.throws(() => calculateBallisticPoint({}), /origin/);
  assert.throws(
    () =>
      integrateBallisticStep({
        position: new Vector3(),
        velocity: new Vector3(),
        gravity: Number.NaN,
        deltaSeconds: 1,
      }),
    /gravidade/,
  );
  assert.throws(
    () =>
      calculateBallisticPoint({
        origin: new Vector3(),
        velocity: new Vector3(),
        gravity: -9.8,
        timeSeconds: -1,
      }),
    /tempo balístico/,
  );
});
