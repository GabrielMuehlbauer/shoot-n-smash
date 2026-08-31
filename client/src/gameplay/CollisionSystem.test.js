import assert from 'node:assert/strict';
import test from 'node:test';

import { Vector3 } from 'three';

import {
  intersectMovingSpheres,
  intersectSegmentSphere,
} from './CollisionSystem.js';

function assertAlmostEqual(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `esperado ${expected}, recebido ${actual}`,
  );
}

function assertVectorAlmostEqual(actual, expected, tolerance = 1e-10) {
  assert.ok(actual instanceof Vector3);
  assertAlmostEqual(actual.x, expected.x, tolerance);
  assertAlmostEqual(actual.y, expected.y, tolerance);
  assertAlmostEqual(actual.z, expected.z, tolerance);
}

test('detecta tunneling pelo primeiro contato do segmento com a esfera', () => {
  const result = intersectSegmentSphere(
    new Vector3(-5, 0, 0),
    new Vector3(5, 0, 0),
    new Vector3(0, 0, 0),
    1,
  );

  assert.equal(result.hit, true);
  assert.equal(result.startedInside, false);
  assertAlmostEqual(result.t, 0.4);
  assertVectorAlmostEqual(result.point, new Vector3(-1, 0, 0));
});

test('considera uma tangência como colisão', () => {
  const result = intersectSegmentSphere(
    new Vector3(-2, 1, 0),
    new Vector3(2, 1, 0),
    new Vector3(),
    1,
  );

  assert.equal(result.hit, true);
  assert.equal(result.startedInside, false);
  assertAlmostEqual(result.t, 0.5);
  assertVectorAlmostEqual(result.point, new Vector3(0, 1, 0));
});

test('início dentro da esfera retorna t zero e uma cópia do ponto inicial', () => {
  const start = new Vector3(0.25, 0, 0);
  const result = intersectSegmentSphere(
    start,
    new Vector3(3, 0, 0),
    new Vector3(),
    1,
  );

  assert.equal(result.hit, true);
  assert.equal(result.startedInside, true);
  assert.equal(result.t, 0);
  assertVectorAlmostEqual(result.point, start);
  assert.notEqual(result.point, start);
});

test('retorna miss quando o segmento não alcança a esfera', () => {
  const result = intersectSegmentSphere(
    new Vector3(-2, 2, 0),
    new Vector3(2, 2, 0),
    new Vector3(),
    1,
  );

  assert.deepEqual(result, {
    hit: false,
    t: null,
    point: null,
    startedInside: false,
  });
});

test('trata segmentos degenerados dentro e fora da esfera', () => {
  const inside = new Vector3(0.5, 0, 0);
  const outside = new Vector3(2, 0, 0);

  const insideResult = intersectSegmentSphere(
    inside,
    inside,
    new Vector3(),
    1,
  );
  const outsideResult = intersectSegmentSphere(
    outside,
    outside,
    new Vector3(),
    1,
  );

  assert.equal(insideResult.hit, true);
  assert.equal(insideResult.startedInside, true);
  assert.equal(insideResult.t, 0);
  assert.equal(outsideResult.hit, false);
  assert.equal(outsideResult.t, null);
});

test('rejeita vetores não finitos e raios inválidos', () => {
  const zero = new Vector3();

  assert.throws(
    () =>
      intersectSegmentSphere(
        new Vector3(Number.NaN, 0, 0),
        zero,
        zero,
        1,
      ),
    /start.*Vector3 finito/i,
  );
  assert.throws(
    () => intersectSegmentSphere(zero, zero, zero, Number.POSITIVE_INFINITY),
    /combinedRadius.*finito/i,
  );
  assert.throws(
    () => intersectSegmentSphere(zero, zero, zero, -0.01),
    /combinedRadius.*negativo/i,
  );
  assert.throws(
    () =>
      intersectMovingSpheres(
        zero,
        zero,
        0.5,
        zero,
        new Vector3(0, Number.NaN, 0),
        0.5,
      ),
    /targetEnd.*Vector3 finito/i,
  );
  assert.throws(
    () => intersectMovingSpheres(zero, zero, -1, zero, zero, 1),
    /projectileRadius.*negativo/i,
  );
  assert.throws(
    () => intersectMovingSpheres(zero, zero, 1, zero, zero, Number.NaN),
    /targetRadius.*finito/i,
  );
});

test('detecta alvo móvel cruzando um projétil quase parado', () => {
  const projectileStart = new Vector3(0, 0, 0);
  const projectileEnd = new Vector3(0.01, 0, 0);
  const targetStart = new Vector3(-5, 0, 0);
  const targetEnd = new Vector3(5, 0, 0);
  const inputsBefore = [
    projectileStart.toArray(),
    projectileEnd.toArray(),
    targetStart.toArray(),
    targetEnd.toArray(),
  ];

  const result = intersectMovingSpheres(
    projectileStart,
    projectileEnd,
    0.5,
    targetStart,
    targetEnd,
    0.5,
  );
  const expectedT = 4 / 9.99;

  assert.equal(result.hit, true);
  assert.equal(result.startedInside, false);
  assertAlmostEqual(result.t, expectedT);
  assertVectorAlmostEqual(
    result.projectileCenter,
    new Vector3(0.01 * expectedT, 0, 0),
  );
  assertVectorAlmostEqual(
    result.targetCenter,
    new Vector3(-5 + 10 * expectedT, 0, 0),
  );
  assertVectorAlmostEqual(result.point, result.projectileCenter);
  assert.notEqual(result.point, result.projectileCenter);
  assert.deepEqual(
    [
      projectileStart.toArray(),
      projectileEnd.toArray(),
      targetStart.toArray(),
      targetEnd.toArray(),
    ],
    inputsBefore,
  );
});

test('movimento relativo paralelo não cria colisão falsa', () => {
  const result = intersectMovingSpheres(
    new Vector3(0, 0, 0),
    new Vector3(10, 0, 0),
    1,
    new Vector3(0, 3, 0),
    new Vector3(10, 3, 0),
    1,
  );

  assert.deepEqual(result, {
    hit: false,
    t: null,
    point: null,
    startedInside: false,
    projectileCenter: null,
    targetCenter: null,
  });
});
