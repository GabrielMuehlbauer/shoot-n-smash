import assert from 'node:assert/strict';
import test from 'node:test';

import { Scene, Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { TargetSystem } from './TargetSystem.js';

function createTarget(options = {}) {
  const scene = new Scene();
  const target = new TargetSystem({ scene, ...options });
  return { scene, target };
}

test('cria um único alvo low-poly móvel com esfera de colisão exposta', () => {
  const { scene, target } = createTarget();

  assert.deepEqual(GAMEPLAY_CONFIG.target.position, {
    x: 4,
    y: 2.15,
    z: -11,
  });
  assert.equal(GAMEPLAY_CONFIG.target.radius, 1.25);
  assert.equal(GAMEPLAY_CONFIG.target.damagePerHit, 25);
  assert.deepEqual(GAMEPLAY_CONFIG.target.movement, {
    minX: -4.5,
    maxX: 4.5,
    speed: 1.6,
    initialDirection: -1,
    rotationSpeed: 0.85,
  });
  assert.equal(target.parent, scene);
  assert.equal(target.children.length, 1);
  assert.equal(target.mesh.name, 'practice-target-core');
  assert.equal(target.isMoving, true);
  assert.deepEqual(target.getCenter().toArray(), [4, 2.15, -11]);
  assert.deepEqual(target.state, {
    alive: true,
    health: 100,
    maxHealth: 100,
    ratio: 1,
  });
  target.dispose();
});

test('move em patrulha senoidal independente da subdivisão dos frames', () => {
  const { target: singleStep } = createTarget();
  const { target: subdivided } = createTarget();

  assert.equal(singleStep.update(1), true);
  for (let frame = 0; frame < 4; frame += 1) {
    subdivided.update(0.25);
  }

  assert.ok(singleStep.position.x < 4);
  assert.ok(singleStep.position.x >= GAMEPLAY_CONFIG.target.movement.minX);
  assert.ok(singleStep.position.x <= GAMEPLAY_CONFIG.target.movement.maxX);
  assert.ok(singleStep.position.distanceTo(subdivided.position) < 1e-12);
  assert.ok(
    Math.abs(singleStep.mesh.rotation.y - subdivided.mesh.rotation.y) < 1e-12,
  );
  assert.deepEqual(singleStep.getPreviousCenter().toArray(), [4, 2.15, -11]);
  assert.equal(singleStep.movementDirection, -1);

  singleStep.update(30);
  assert.ok(singleStep.position.x >= GAMEPLAY_CONFIG.target.movement.minX);
  assert.ok(singleStep.position.x <= GAMEPLAY_CONFIG.target.movement.maxX);
  const sampledPosition = singleStep.position.clone();
  singleStep.update(-10);
  singleStep.update(Number.NaN);
  singleStep.update(Number.POSITIVE_INFINITY);
  assert.equal(singleStep.position.equals(sampledPosition), true);
  singleStep.dispose();
  subdivided.dispose();
});

test('pode congelar o movimento na fração exata do frame', () => {
  const { target } = createTarget();
  const start = target.position.clone();
  target.update(1);
  const end = target.position.clone();
  const expected = start.clone().lerp(end, 0.25);

  assert.equal(target.pauseAtFrameRatio(0.25), true);
  assert.ok(target.position.distanceTo(expected) < 1e-12);
  assert.ok(target.getPreviousCenter().distanceTo(expected) < 1e-12);
  assert.ok(Math.abs(target.elapsedMovementSeconds - 0.25) < 1e-12);
  assert.ok(
    Math.abs(
      target.mesh.rotation.y -
        GAMEPLAY_CONFIG.target.movement.rotationSpeed * 0.25,
    ) < 1e-12,
  );
  assert.equal(target.pauseAtFrameRatio(-1), false);
  assert.equal(target.pauseAtFrameRatio(Number.NaN), false);
  target.dispose();
});

test('aplica quatro danos, limita a vida a zero e destrói uma única vez', () => {
  const healthChanges = [];
  const destructions = [];
  const { target } = createTarget({
    onDestroy: (state) => destructions.push(state),
    onHealthChange: (state) => healthChanges.push(state),
  });

  for (let hit = 0; hit < 4; hit += 1) {
    assert.equal(target.applyDamage(), true);
  }

  assert.deepEqual(
    healthChanges.map(({ health }) => health),
    [75, 50, 25, 0],
  );
  assert.equal(destructions.length, 1);
  assert.deepEqual(target.state, {
    alive: false,
    health: 0,
    maxHealth: 100,
    ratio: 0,
  });
  assert.equal(target.applyDamage(), false);
  assert.equal(healthChanges.length, 4);
  assert.equal(destructions.length, 1);
  assert.equal(
    target.material.color.getHex(),
    GAMEPLAY_CONFIG.target.colors.destroyed,
  );
  const destroyedPosition = target.position.clone();
  target.update(3);
  assert.equal(target.position.equals(destroyedPosition), true);
  assert.equal(target.isMoving, false);
  target.dispose();
});

test('reset restaura a vida e o visual sem emitir evento de dano', () => {
  const healthChanges = [];
  const { target } = createTarget({
    onHealthChange: (state) => healthChanges.push(state),
  });

  assert.equal(target.reset(), false);
  target.update(0.5);
  target.applyDamage(40);
  assert.equal(target.reset(), true);
  assert.equal(target.health, 100);
  assert.equal(target.alive, true);
  assert.equal(target.mesh.scale.equals(new Vector3(1, 1, 1)), true);
  assert.equal(target.position.equals(target.initialPosition), true);
  assert.equal(target.previousPosition.equals(target.initialPosition), true);
  assert.equal(target.elapsedMovementSeconds, 0);
  assert.equal(target.movementDirection, -1);
  assert.equal(
    target.material.color.getHex(),
    GAMEPLAY_CONFIG.target.colors.active,
  );
  assert.equal(healthChanges.length, 1);
  target.dispose();
});

test('valida configuração, callbacks, dano e vetor de saída', () => {
  const scene = new Scene();
  const baseConfig = GAMEPLAY_CONFIG.target;

  assert.throws(() => new TargetSystem(), /cena Three\.js válida/);
  assert.throws(
    () =>
      new TargetSystem({
        scene,
        config: { ...baseConfig, radius: 0 },
      }),
    /target\.radius.*maior que zero/,
  );
  assert.throws(
    () =>
      new TargetSystem({
        scene,
        config: {
          ...baseConfig,
          movement: { ...baseConfig.movement, minX: 5 },
        },
      }),
    /limites de movimento válidos/,
  );
  assert.throws(
    () =>
      new TargetSystem({
        scene,
        config: {
          ...baseConfig,
          movement: { ...baseConfig.movement, speed: 0 },
        },
      }),
    /velocidade de movimento positiva/,
  );
  assert.throws(
    () =>
      new TargetSystem({
        scene,
        config: {
          ...baseConfig,
          movement: { ...baseConfig.movement, initialDirection: 0 },
        },
      }),
    /direção inicial/,
  );
  assert.throws(
    () => new TargetSystem({ scene, onHealthChange: null }),
    /onHealthChange como função/,
  );

  const target = new TargetSystem({ scene });
  assert.throws(() => target.applyDamage(0), /dano.*maior que zero/i);
  assert.throws(() => target.getCenter({}), /Vector3/);
  target.dispose();
});

test('mantém a transição de estado se um observador falhar', () => {
  const failure = new Error('falha do observador');
  const destructions = [];
  const { target } = createTarget({
    onHealthChange: () => {
      throw failure;
    },
    onDestroy: (state) => destructions.push(state),
  });

  assert.throws(() => target.applyDamage(100), failure);
  assert.equal(target.health, 0);
  assert.equal(target.alive, false);
  assert.equal(destructions.length, 1);
  target.dispose();
});

test('dispose remove o alvo e os recursos uma única vez', () => {
  const { scene, target } = createTarget();
  let geometryDisposals = 0;
  let materialDisposals = 0;
  const disposeGeometry = target.geometry.dispose.bind(target.geometry);
  const disposeMaterial = target.material.dispose.bind(target.material);

  target.geometry.dispose = () => {
    geometryDisposals += 1;
    disposeGeometry();
  };
  target.material.dispose = () => {
    materialDisposals += 1;
    disposeMaterial();
  };

  assert.equal(target.dispose(), true);
  assert.equal(target.dispose(), false);
  assert.equal(target.parent, null);
  assert.equal(scene.getObjectByName('practice-target'), undefined);
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
  assert.equal(target.update(1), false);
  assert.equal(target.reset(), false);
  assert.equal(target.pauseAtFrameRatio(0.5), false);
  assert.equal(target.isMoving, false);
});
