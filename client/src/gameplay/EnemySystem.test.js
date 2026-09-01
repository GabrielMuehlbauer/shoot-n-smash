import assert from 'node:assert/strict';
import test from 'node:test';

import { Scene, Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import {
  createEnemySpawnPosition,
  EnemySystem,
} from './EnemySystem.js';

function createConfig(overrides = {}) {
  const base = GAMEPLAY_CONFIG.enemy;

  return {
    ...base,
    ...overrides,
    playerPosition:
      'playerPosition' in overrides
        ? overrides.playerPosition
        : { ...base.playerPosition },
    spawn: { ...base.spawn, ...overrides.spawn },
    animation: { ...base.animation, ...overrides.animation },
    colors: { ...base.colors, ...overrides.colors },
  };
}

function createSequenceRandom(...values) {
  let index = 0;

  return () => {
    const value = values[index];
    index += 1;
    return value;
  };
}

function createEnemy(options = {}) {
  const scene = options.scene ?? new Scene();
  const enemy = new EnemySystem({
    scene,
    random: createSequenceRandom(0, 0),
    ...options,
  });

  return { enemy, scene };
}

function assertAlmostEqual(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `esperado ${expected}, recebido ${actual}`,
  );
}

function assertVectorAlmostEqual(actual, expected, tolerance = 1e-10) {
  assertAlmostEqual(actual.x, expected.x, tolerance);
  assertAlmostEqual(actual.y, expected.y, tolerance);
  assertAlmostEqual(actual.z, expected.z, tolerance);
}

test('sorteia o spawn em 360 graus dentro do anel configurado', () => {
  const config = createConfig({
    playerPosition: { x: 3, y: 1.1, z: -2 },
    playerContactRadius: 1,
    spawn: { minRadius: 5, maxRadius: 9, height: 1.25 },
  });
  const reusedTarget = new Vector3();
  const minimum = createEnemySpawnPosition({
    config,
    random: createSequenceRandom(0, 0),
    target: reusedTarget,
  });

  assert.equal(minimum, reusedTarget);
  assertVectorAlmostEqual(minimum, new Vector3(8, 1.25, -2));

  const middle = createEnemySpawnPosition({
    config,
    random: createSequenceRandom(0.25, 0.5),
  });

  assertVectorAlmostEqual(middle, new Vector3(3, 1.25, 5));

  for (const angleRatio of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]) {
    const position = createEnemySpawnPosition({
      config,
      random: createSequenceRandom(angleRatio, 0.75),
    });
    const radius = Math.hypot(
      position.x - config.playerPosition.x,
      position.z - config.playerPosition.z,
    );

    assertAlmostEqual(radius, 8);
    assert.equal(position.y, config.spawn.height);
  }
});

test('rejeita geradores aleatórios inválidos nas duas amostras do spawn', () => {
  for (const invalidValue of [-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () =>
        createEnemySpawnPosition({
          random: createSequenceRandom(invalidValue, 0),
        }),
      /entre 0 e 1/,
    );
    assert.throws(
      () =>
        createEnemySpawnPosition({
          random: createSequenceRandom(0, invalidValue),
        }),
      /entre 0 e 1/,
    );
  }

  assert.throws(
    () => createEnemySpawnPosition({ random: null }),
    /random como função/,
  );
  assert.throws(
    () => createEnemySpawnPosition({ target: {} }),
    /Vector3 para o spawn/,
  );
});

test('cria o monstro de gelo com visual, collider e estado inicial coerentes', () => {
  const { enemy, scene } = createEnemy({
    random: createSequenceRandom(0.5, 0),
  });

  assert.equal(GAMEPLAY_CONFIG.enemy.radius, 1.05);
  assert.equal(GAMEPLAY_CONFIG.enemy.maxResistance, 1);
  assert.equal(GAMEPLAY_CONFIG.enemy.moveSpeed, 1.25);
  assert.equal(GAMEPLAY_CONFIG.enemy.playerContactRadius, 1.5);
  assert.deepEqual(GAMEPLAY_CONFIG.enemy.spawn, {
    minRadius: 17,
    maxRadius: 20,
    height: 1.05,
  });
  assert.equal(enemy.parent, scene);
  assert.equal(enemy.name, 'ice-enemy');
  assert.equal(enemy.visual.name, 'ice-enemy-visual');
  assert.equal(enemy.visual.children.length, 8);
  assert.equal(enemy.geometries.size, 5);
  assert.equal(enemy.materials.size, 3);
  assert.equal(enemy.body.name, 'ice-enemy-body');
  assert.equal(enemy.leftArm.name, 'ice-enemy-left-arm');
  assert.equal(enemy.rightArm.name, 'ice-enemy-right-arm');
  assert.equal(enemy.active, true);
  assert.equal(enemy.alive, true);
  assert.equal(enemy.isMoving, true);
  assert.equal(enemy.playerContactFrameRatio, null);
  assertAlmostEqual(enemy.distanceToPlayer, 17);
  assertVectorAlmostEqual(enemy.getCenter(), enemy.position);
  assertVectorAlmostEqual(enemy.getPreviousCenter(), enemy.position);
  assert.deepEqual(enemy.state, {
    active: true,
    outcome: null,
    resistance: 1,
    maxResistance: 1,
    ratio: 1,
    distanceToPlayer: enemy.distanceToPlayer,
  });

  enemy.dispose();
});

test('aproxima-se do jogador sem depender da subdivisão dos frames', () => {
  const config = createConfig({
    moveSpeed: 2,
    playerContactRadius: 1,
    playerPosition: { x: 2, y: 1, z: -3 },
    spawn: { minRadius: 10, maxRadius: 10, height: 1 },
  });
  const { enemy: singleStep } = createEnemy({ config });
  const { enemy: subdivided } = createEnemy({ config });
  const initialPosition = singleStep.position.clone();

  assert.equal(singleStep.update(1.5), true);
  for (let frame = 0; frame < 6; frame += 1) {
    subdivided.update(0.25);
  }

  assertAlmostEqual(singleStep.distanceToPlayer, 7);
  assertVectorAlmostEqual(singleStep.position, subdivided.position);
  assertAlmostEqual(
    singleStep.elapsedMovementSeconds,
    subdivided.elapsedMovementSeconds,
  );
  assertAlmostEqual(singleStep.visual.position.y, subdivided.visual.position.y);
  assertAlmostEqual(singleStep.leftArm.rotation.x, subdivided.leftArm.rotation.x);
  assertAlmostEqual(singleStep.rightArm.rotation.x, subdivided.rightArm.rotation.x);
  assertVectorAlmostEqual(singleStep.getPreviousCenter(), initialPosition);
  assert.equal(singleStep.playerContactFrameRatio, null);

  const sampledPosition = singleStep.position.clone();
  singleStep.update(-1);
  singleStep.update(Number.NaN);
  singleStep.update(Number.POSITIVE_INFINITY);
  assertVectorAlmostEqual(singleStep.position, sampledPosition);

  singleStep.dispose();
  subdivided.dispose();
});

test('mantém o contato pendente até uma resolução única', () => {
  const contacts = [];
  const config = createConfig({
    moveSpeed: 4,
    playerContactRadius: 1,
    playerPosition: { x: 0, y: 1, z: 0 },
    spawn: { minRadius: 3, maxRadius: 3, height: 1 },
  });
  const { enemy, scene } = createEnemy({
    config,
    onPlayerContact: (state) => contacts.push(state),
  });

  assert.equal(enemy.update(1), true);
  assertAlmostEqual(enemy.distanceToPlayer, 1);
  assertAlmostEqual(enemy.playerContactFrameRatio, 0.5);
  assert.equal(enemy.pendingPlayerContact, true);
  assert.equal(enemy.isMoving, false);
  assert.equal(enemy.active, true);
  assert.equal(enemy.outcome, null);
  assert.equal(contacts.length, 0);

  const contactPosition = enemy.position.clone();
  enemy.update(10);
  assertVectorAlmostEqual(enemy.position, contactPosition);
  assertAlmostEqual(enemy.playerContactFrameRatio, 0.5);

  assert.equal(enemy.resolvePlayerContact(), true);
  assert.equal(enemy.resolvePlayerContact(), false);
  assert.equal(enemy.parent, null);
  assert.equal(scene.getObjectByName('ice-enemy'), undefined);
  assert.equal(enemy.pendingPlayerContact, false);
  assert.equal(enemy.playerContactFrameRatio, null);
  assert.equal(enemy.active, false);
  assert.equal(enemy.isMoving, false);
  assert.equal(enemy.outcome, 'player-contact');
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].outcome, 'player-contact');
  assert.equal(contacts[0].active, false);

  enemy.dispose();
});

test('aplica resistência configurável e remove o inimigo ao eliminá-lo', () => {
  const resistanceChanges = [];
  const eliminations = [];
  const config = createConfig({ maxResistance: 3 });
  const { enemy, scene } = createEnemy({
    config,
    onEliminate: (state) => eliminations.push(state),
    onResistanceChange: (state) => resistanceChanges.push(state),
  });

  assert.equal(enemy.applyHit(), true);
  assert.equal(enemy.resistance, 2);
  assert.equal(enemy.active, true);
  assert.equal(enemy.parent, scene);
  assert.equal(
    enemy.iceMaterial.color.getHex(),
    config.colors.damaged,
  );
  assert.equal(enemy.applyHit(2), true);

  assert.deepEqual(
    resistanceChanges.map(({ resistance }) => resistance),
    [2, 0],
  );
  assert.equal(eliminations.length, 1);
  assert.equal(enemy.resistance, 0);
  assert.equal(enemy.outcome, 'eliminated');
  assert.equal(enemy.active, false);
  assert.equal(enemy.alive, false);
  assert.equal(enemy.parent, null);
  assert.equal(scene.getObjectByName('ice-enemy'), undefined);
  assert.equal(enemy.applyHit(), false);
  assert.equal(resistanceChanges.length, 2);
  assert.equal(eliminations.length, 1);
  assert.equal(
    enemy.iceMaterial.color.getHex(),
    config.colors.destroyed,
  );
  assert.equal(enemy.iceMaterial.emissiveIntensity, 0);
  assert.equal(enemy.visual.scale.equals(new Vector3(0.72, 0.72, 0.72)), true);

  enemy.dispose();
});

test('reset restaura estado, visual e um novo spawn sem emitir callbacks', () => {
  const resistanceChanges = [];
  const eliminations = [];
  const config = createConfig({
    maxResistance: 2,
    playerContactRadius: 1,
    spawn: { minRadius: 5, maxRadius: 9, height: 1 },
  });
  const random = createSequenceRandom(0, 0, 0.25, 0.5);
  const { enemy, scene } = createEnemy({
    config,
    random,
    onEliminate: (state) => eliminations.push(state),
    onResistanceChange: (state) => resistanceChanges.push(state),
  });

  enemy.update(0.5);
  enemy.applyHit(2);
  assert.equal(enemy.parent, null);
  assert.equal(enemy.outcome, 'eliminated');

  assert.equal(enemy.reset(), true);
  assert.equal(enemy.parent, scene);
  assert.equal(enemy.active, true);
  assert.equal(enemy.outcome, null);
  assert.equal(enemy.resistance, 2);
  assert.equal(enemy.pendingPlayerContact, false);
  assert.equal(enemy.playerContactFrameRatio, null);
  assert.equal(enemy.elapsedMovementSeconds, 0);
  assert.equal(enemy.previousElapsedMovementSeconds, 0);
  assertVectorAlmostEqual(enemy.position, new Vector3(0, 1, 7));
  assertVectorAlmostEqual(enemy.previousPosition, enemy.position);
  assert.equal(enemy.visual.scale.equals(new Vector3(1, 1, 1)), true);
  assert.equal(enemy.visual.rotation.z, 0);
  assertAlmostEqual(enemy.visual.position.y, 0);
  assertAlmostEqual(enemy.leftArm.rotation.x, 0);
  assertAlmostEqual(enemy.rightArm.rotation.x, 0);
  assert.equal(enemy.iceMaterial.color.getHex(), config.colors.active);
  assert.equal(enemy.iceMaterial.emissive.getHex(), config.colors.emissive);
  assert.equal(enemy.iceMaterial.emissiveIntensity, 0.28);
  assert.equal(resistanceChanges.length, 1);
  assert.equal(eliminations.length, 1);

  enemy.dispose();
});

test('preserva transições quando callbacks de resistência ou eliminação falham', () => {
  const resistanceFailure = new Error('falha em onResistanceChange');
  const eliminationsAfterFailure = [];
  const { enemy: resistanceEnemy } = createEnemy({
    config: createConfig({ maxResistance: 1 }),
    onResistanceChange: () => {
      throw resistanceFailure;
    },
    onEliminate: (state) => eliminationsAfterFailure.push(state),
  });

  assert.throws(() => resistanceEnemy.applyHit(), resistanceFailure);
  assert.equal(resistanceEnemy.resistance, 0);
  assert.equal(resistanceEnemy.outcome, 'eliminated');
  assert.equal(resistanceEnemy.parent, null);
  assert.equal(eliminationsAfterFailure.length, 1);
  resistanceEnemy.dispose();

  const eliminationFailure = new Error('falha em onEliminate');
  const { enemy: eliminationEnemy } = createEnemy({
    onEliminate: () => {
      throw eliminationFailure;
    },
  });

  assert.throws(() => eliminationEnemy.applyHit(), eliminationFailure);
  assert.equal(eliminationEnemy.resistance, 0);
  assert.equal(eliminationEnemy.outcome, 'eliminated');
  assert.equal(eliminationEnemy.active, false);
  assert.equal(eliminationEnemy.parent, null);
  eliminationEnemy.dispose();
});

test('preserva contato terminal e remoção quando seu callback falha', () => {
  const failure = new Error('falha em onPlayerContact');
  const config = createConfig({
    moveSpeed: 4,
    playerContactRadius: 1,
    spawn: { minRadius: 3, maxRadius: 3, height: 1 },
  });
  const { enemy } = createEnemy({
    config,
    onPlayerContact: () => {
      throw failure;
    },
  });

  enemy.update(1);
  assert.throws(() => enemy.resolvePlayerContact(), failure);
  assert.equal(enemy.outcome, 'player-contact');
  assert.equal(enemy.active, false);
  assert.equal(enemy.pendingPlayerContact, false);
  assert.equal(enemy.parent, null);
  assert.equal(enemy.resolvePlayerContact(), false);

  enemy.dispose();
});

test('valida configuração, callbacks, acertos e vetores de saída', () => {
  const scene = new Scene();
  const base = createConfig();

  assert.throws(() => new EnemySystem(), /cena Three\.js válida/);

  for (const name of [
    'radius',
    'maxResistance',
    'moveSpeed',
    'playerContactRadius',
  ]) {
    assert.throws(
      () => new EnemySystem({ scene, config: createConfig({ [name]: 0 }) }),
      new RegExp(`enemy\\.${name}.*maior que zero`),
    );
  }

  assert.throws(
    () =>
      new EnemySystem({
        scene,
        config: createConfig({ maxResistance: 1.5 }),
      }),
    /maxResistance deve ser um inteiro/,
  );
  assert.throws(
    () =>
      new EnemySystem({
        scene,
        config: createConfig({ playerPosition: { x: 0, y: 0, z: NaN } }),
      }),
    /playerPosition.*finita/,
  );
  assert.throws(
    () =>
      new EnemySystem({
        scene,
        config: createConfig({ spawn: { minRadius: base.playerContactRadius } }),
      }),
    /anel de spawn válido/,
  );
  assert.throws(
    () =>
      new EnemySystem({
        scene,
        config: createConfig({ spawn: { minRadius: 21, maxRadius: 20 } }),
      }),
    /anel de spawn válido/,
  );
  assert.throws(
    () =>
      new EnemySystem({
        scene,
        config: createConfig({ spawn: { height: -1 } }),
      }),
    /spawn\.height/,
  );
  assert.throws(
    () =>
      new EnemySystem({
        scene,
        config: createConfig({ animation: { bobAmplitude: -1 } }),
      }),
    /animation\.bobAmplitude/,
  );
  assert.throws(
    () =>
      new EnemySystem({
        scene,
        config: createConfig({ colors: { eyes: 'azul' } }),
      }),
    /colors\.eyes/,
  );

  for (const callback of [
    'random',
    'onEliminate',
    'onPlayerContact',
    'onResistanceChange',
  ]) {
    assert.throws(
      () => new EnemySystem({ scene, [callback]: null }),
      new RegExp(`${callback} como função`),
    );
  }

  const { enemy } = createEnemy();
  assert.throws(() => enemy.applyHit(0), /inteiro positivo/);
  assert.throws(() => enemy.applyHit(1.5), /inteiro positivo/);
  assert.throws(() => enemy.getCenter({}), /Vector3 para o centro/);
  assert.throws(() => enemy.getPreviousCenter({}), /Vector3 para o centro anterior/);
  assert.equal(enemy.pauseAtFrameRatio(-1), false);
  assert.equal(enemy.pauseAtFrameRatio(1.01), false);
  assert.equal(enemy.pauseAtFrameRatio(Number.NaN), false);
  assert.equal(enemy.resolvePlayerContact(), false);
  enemy.dispose();
});

test('dispose remove o inimigo e libera cada recurso uma única vez', () => {
  const { enemy, scene } = createEnemy();
  const geometryDisposals = new Map();
  const materialDisposals = new Map();

  for (const geometry of enemy.geometries) {
    const originalDispose = geometry.dispose.bind(geometry);
    geometryDisposals.set(geometry, 0);
    geometry.dispose = () => {
      geometryDisposals.set(geometry, geometryDisposals.get(geometry) + 1);
      originalDispose();
    };
  }

  for (const material of enemy.materials) {
    const originalDispose = material.dispose.bind(material);
    materialDisposals.set(material, 0);
    material.dispose = () => {
      materialDisposals.set(material, materialDisposals.get(material) + 1);
      originalDispose();
    };
  }

  assert.equal(enemy.dispose(), true);
  assert.equal(enemy.dispose(), false);
  assert.equal(enemy.parent, null);
  assert.equal(scene.getObjectByName('ice-enemy'), undefined);
  assert.deepEqual([...geometryDisposals.values()], [1, 1, 1, 1, 1]);
  assert.deepEqual([...materialDisposals.values()], [1, 1, 1]);
  assert.equal(enemy.disposed, true);
  assert.equal(enemy.active, false);
  assert.equal(enemy.alive, false);
  assert.equal(enemy.isMoving, false);
  assert.equal(enemy.update(1), false);
  assert.equal(enemy.reset(), false);
  assert.equal(enemy.pauseAtFrameRatio(0.5), false);
  assert.equal(enemy.applyHit(), false);
  assert.equal(enemy.resolvePlayerContact(), false);
});
