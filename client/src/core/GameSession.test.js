import assert from 'node:assert/strict';
import test from 'node:test';

import { PerspectiveCamera, Scene, Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { GameSession } from './GameSession.js';

function createCamera() {
  const camera = new PerspectiveCamera(65, 1, 0.1, 120);
  camera.position.set(1, 1.65, 2);
  camera.lookAt(1, 1.65, -1);
  return camera;
}

function createProjectileSystem() {
  const spawnCalls = [];
  const updateCalls = [];

  return {
    activeProjectileCount: 0,
    disposeCalls: 0,
    spawnCalls,
    updateCalls,
    spawn(payload) {
      spawnCalls.push({
        origin: payload.origin.clone(),
        direction: payload.direction.clone(),
        speed: payload.speed,
        charge: payload.charge,
      });
      this.activeProjectileCount += 1;
      return {};
    },
    update(deltaSeconds) {
      updateCalls.push(deltaSeconds);
      return true;
    },
    dispose() {
      this.disposeCalls += 1;
      this.activeProjectileCount = 0;
      return true;
    },
  };
}

function createGameplayConfig({ enemy = {}, projectile = {} } = {}) {
  const enemyTypes =
    'types' in enemy
      ? enemy.types
      : [{ ...GAMEPLAY_CONFIG.enemy.types[0] }];
  const typeIds = enemyTypes.map(({ id }) => id);

  return {
    ...GAMEPLAY_CONFIG,
    waves: {
      ...GAMEPLAY_CONFIG.waves,
      definitions: GAMEPLAY_CONFIG.waves.definitions.map((wave) => ({
        ...wave,
        moveSpeed: enemy.moveSpeed ?? GAMEPLAY_CONFIG.enemy.moveSpeed,
        typeIds,
      })),
    },
    projectile: {
      ...GAMEPLAY_CONFIG.projectile,
      gravity: 0,
      groundY: -100,
      ...projectile,
    },
    enemy: {
      ...GAMEPLAY_CONFIG.enemy,
      ...enemy,
      types: enemyTypes,
      playerPosition: {
        ...GAMEPLAY_CONFIG.enemy.playerPosition,
        ...enemy.playerPosition,
      },
      spawn: {
        ...GAMEPLAY_CONFIG.enemy.spawn,
        minRadius: 10,
        maxRadius: 10,
        ...enemy.spawn,
      },
      animation: {
        ...GAMEPLAY_CONFIG.enemy.animation,
        ...enemy.animation,
      },
      colors: {
        ...GAMEPLAY_CONFIG.enemy.colors,
        ...enemy.colors,
      },
    },
  };
}

function spawnShotAlongPositiveX(session, { originX = 0, speed = 24 } = {}) {
  return session.projectileSystem.spawn({
    origin: new Vector3(originX, session.enemySystem.position.y, 0),
    direction: new Vector3(1, 0, 0),
    speed,
  });
}

function assertAlmostEqual(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `esperado ${expected}, recebido ${actual}`,
  );
}

test('carrega de 0 a 1 e dispara na direção mundial da câmera', () => {
  const chargeStates = [];
  const shots = [];
  const projectileSystem = createProjectileSystem();
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    enemyRandom: () => 0,
    projectileSystem,
    onChargeChange: (state) => chargeStates.push(state),
    onShot: (shot) => shots.push(shot),
  });

  assert.equal(session.beginCharge(), true);
  assert.equal(session.beginCharge(), false);
  session.update(0.6);
  session.update(10);

  assert.equal(session.isCharging, true);
  assert.deepEqual(
    chargeStates.map(({ charging, ratio }) => [charging, ratio]),
    [
      [true, 0],
      [true, 0.5],
      [true, 1],
    ],
  );

  const shot = session.releaseShot();
  const spawn = projectileSystem.spawnCalls[0];

  assert.equal(session.isCharging, false);
  assert.equal(session.activeProjectileCount, 1);
  assert.equal(shot.charge, 1);
  assert.equal(shot.ratio, 1);
  assert.equal(shot.speed, GAMEPLAY_CONFIG.projectile.maxSpeed);
  assert.equal(shot.activeProjectileCount, 1);
  assert.deepEqual(shots, [shot]);
  assertAlmostEqual(spawn.origin.x, 1);
  assertAlmostEqual(spawn.origin.y, 1.65);
  assertAlmostEqual(
    spawn.origin.z,
    2 - GAMEPLAY_CONFIG.projectile.spawnDistance,
  );
  assertAlmostEqual(spawn.direction.x, 0);
  assertAlmostEqual(spawn.direction.y, 0);
  assertAlmostEqual(spawn.direction.z, -1);
  assert.equal(spawn.charge, 1);
  assert.deepEqual(chargeStates.at(-1), { charging: false, ratio: 0 });
  session.dispose();
});

test('clique rápido usa velocidade mínima e cancelamento não dispara', () => {
  const chargeStates = [];
  const projectileSystem = createProjectileSystem();
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    enemyRandom: () => 0,
    projectileSystem,
    onChargeChange: (state) => chargeStates.push(state),
  });

  session.beginCharge();
  const shot = session.releaseShot();
  assert.equal(shot.speed, GAMEPLAY_CONFIG.projectile.minSpeed);
  assert.equal(projectileSystem.spawnCalls.length, 1);

  session.beginCharge();
  session.update(0.3);
  assert.equal(session.cancelCharge(), true);
  assert.equal(projectileSystem.spawnCalls.length, 1);
  assert.deepEqual(chargeStates.at(-1), { charging: false, ratio: 0 });
  session.dispose();
});

test('update saneia deltas e dispose é idempotente', () => {
  const projectileSystem = createProjectileSystem();
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    enemyRandom: () => 0,
    projectileSystem,
  });

  session.update(-2);
  session.update(Number.NaN);
  session.update(Number.POSITIVE_INFINITY);

  assert.deepEqual(projectileSystem.updateCalls, [0, 0, 0]);
  assert.equal(session.dispose(), true);
  assert.equal(session.dispose(), false);
  assert.equal(projectileSystem.disposeCalls, 1);
  assert.equal(session.update(0.1), false);
  assert.throws(() => session.beginCharge(), /GameSession descartada/);
  assert.throws(() => session.releaseShot(), /GameSession descartada/);
});

test('pausa a aproximação enquanto o encontro está inativo', () => {
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: createGameplayConfig(),
    encounterActive: false,
    enemyRandom: () => 0,
  });
  const initialPosition = session.enemySystem.position.clone();

  session.update(1);
  assert.equal(session.enemySystem.position.equals(initialPosition), true);
  assert.equal(session.setEncounterActive(false), false);
  assert.equal(session.setEncounterActive(true), true);
  session.update(1);
  assert.ok(session.enemySystem.position.x < initialPosition.x);
  assert.throws(() => session.setEncounterActive('sim'), /booleano/);
  session.dispose();
  assert.throws(() => session.setEncounterActive(true), /descartada/);
});

test('coordena sistemas e resolve contato depois das colisões', () => {
  const calls = [];
  const projectileSystem = {
    activeProjectileCount: 3,
    update: (delta) => calls.push(['projectiles.update', delta]),
    dispose: () => calls.push(['projectiles.dispose']),
  };
  const slingshotSystem = {
    isCharging: false,
    beginCharge: () => true,
    releaseShot: () => ({ ratio: 0.5 }),
    cancelCharge: () => true,
    update: (delta) => calls.push(['slingshot.update', delta]),
    dispose: () => calls.push(['slingshot.dispose']),
  };
  const enemySystem = {
    active: false,
    update: (delta) => calls.push(['enemy.update', delta]),
    resolvePlayerContact: () => calls.push(['enemy.resolveContact']),
    state: {
      active: false,
      outcome: 'eliminated',
      resistance: 0,
      maxResistance: 1,
      ratio: 0,
      type: { id: 'weak', label: 'Fraco' },
      distanceToPlayer: 8,
    },
    dispose: () => calls.push(['enemy.dispose']),
  };
  const impactFeedbackSystem = {
    activeCount: 0,
    update: (delta) => calls.push(['feedback.update', delta]),
    dispose: () => calls.push(['feedback.dispose']),
  };
  const playerHealthSystem = {
    state: {
      health: 100,
      maxHealth: 100,
      ratio: 1,
      depleted: false,
    },
    dispose: () => calls.push(['player.dispose']),
  };
  const session = new GameSession({
    enemySystem,
    impactFeedbackSystem,
    playerHealthSystem,
    projectileSystem,
    slingshotSystem,
  });

  session.update(0.016);
  assert.equal(session.activeProjectileCount, 3);
  assert.equal(session.dispose(), true);

  assert.deepEqual(calls, [
    ['slingshot.update', 0.016],
    ['enemy.update', 0.016],
    ['feedback.update', 0.016],
    ['projectiles.update', 0.016],
    ['enemy.resolveContact'],
    ['slingshot.dispose'],
    ['projectiles.dispose'],
    ['enemy.dispose'],
    ['player.dispose'],
    ['feedback.dispose'],
  ]);
});

test('anexa inimigo ao cenário e expõe resistência inicial', () => {
  const scene = new Scene();
  const session = new GameSession({
    camera: createCamera(),
    scene,
    enemyRandom: () => 0,
    enemyTypeRandom: () => 0,
  });

  assert.equal(session.enemySystem.parent, scene);
  assert.equal(session.impactFeedbackSystem.parent, scene);
  assert.equal(session.activeImpactFeedbackCount, 0);
  assert.deepEqual(session.playerState, {
    health: 100,
    maxHealth: 100,
    ratio: 1,
    depleted: false,
  });
  assert.deepEqual(session.enemyState, {
    active: true,
    outcome: null,
    resistance: 1,
    maxResistance: 1,
    ratio: 1,
    type: { id: 'weak', label: 'Fraco', damage: 1 },
    distanceToPlayer: 17,
  });
  session.dispose();
  assert.equal(session.enemySystem.parent, null);
});

test('seleciona cada tipo com RNG independente sem deslocar o spawn', () => {
  const config = createGameplayConfig({
    enemy: { types: GAMEPLAY_CONFIG.enemy.types },
  });
  const cases = [
    [0, 'weak', 1],
    [1 / 3, 'medium', 2],
    [2 / 3, 'resistant', 3],
  ];

  for (const [typeRatio, expectedId, expectedResistance] of cases) {
    let spawnSamples = 0;
    let typeSamples = 0;
    const session = new GameSession({
      camera: createCamera(),
      scene: new Scene(),
      config,
      enemyRandom: () => {
        spawnSamples += 1;
        return 0;
      },
      enemyTypeRandom: () => {
        typeSamples += 1;
        return typeRatio;
      },
    });

    assert.equal(session.enemySystem.position.x, 10);
    assert.equal(session.enemySystem.position.z, 0);
    assert.equal(spawnSamples, 2);
    assert.equal(typeSamples, 1);
    assert.equal(session.enemyState.type.id, expectedId);
    assert.equal(session.enemyState.maxResistance, expectedResistance);
    assert.equal(session.enemyState.resistance, expectedResistance);
    session.dispose();
  }
});

test('colisão móvel aplica resistência, feedback e consumo uma vez por projétil', () => {
  const resistanceChanges = [];
  const hits = [];
  const eliminations = [];
  const config = createGameplayConfig({
    enemy: {
      moveSpeed: 1,
      types: [{ ...GAMEPLAY_CONFIG.enemy.types[2] }],
    },
  });
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config,
    enemyRandom: () => 0,
    onEnemyEliminate: (state) => eliminations.push(state),
    onEnemyHit: (hit) => hits.push(hit),
    onEnemyResistanceChange: (state) => resistanceChanges.push(state),
  });

  for (let hit = 0; hit < 3; hit += 1) {
    spawnShotAlongPositiveX(session);
    session.update(0.5);
    assert.equal(session.activeProjectileCount, 0);
  }

  assert.deepEqual(
    resistanceChanges.map(({ resistance }) => resistance),
    [2, 1, 0],
  );
  assert.deepEqual(
    hits.map(({ resistance }) => resistance),
    [2, 1, 0],
  );
  assert.equal(hits.every(({ hitStrength }) => hitStrength === 1), true);
  assert.equal(hits.every(({ type }) => type.id === 'resistant'), true);
  assert.equal(eliminations.length, 1);
  assert.deepEqual(eliminations[0].type, {
    id: 'resistant',
    label: 'Resistente',
    damage: 3,
  });
  assert.equal(session.enemyState.outcome, 'eliminated');
  assert.equal(session.enemyState.resistance, 0);
  assert.equal(session.enemySystem.parent, null);
  assert.equal(session.activeImpactFeedbackCount, 1);

  spawnShotAlongPositiveX(session);
  session.update(0.5);
  assert.equal(resistanceChanges.length, 3);
  assert.equal(hits.length, 3);
  session.dispose();
});

test('ordena impactos simultâneos pela fração temporal global', () => {
  const hits = [];
  const config = createGameplayConfig({
    enemy: {
      moveSpeed: Number.EPSILON,
      types: [{ ...GAMEPLAY_CONFIG.enemy.types[2] }],
    },
  });
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config,
    enemyRandom: () => 0,
    onEnemyHit: (hit) => hits.push(hit),
  });
  const fasterProjectile = spawnShotAlongPositiveX(session, { speed: 20 });
  const slowerProjectile = spawnShotAlongPositiveX(session, { speed: 10 });

  session.update(1);

  assert.equal(hits.length, 2);
  assert.equal(hits[0].projectile, fasterProjectile);
  assert.equal(hits[1].projectile, slowerProjectile);
  assert.ok(hits[0].impactRatio < hits[1].impactRatio);
  assert.deepEqual(
    hits.map(({ resistance }) => resistance),
    [2, 1],
  );
  assert.equal(session.enemyState.outcome, null);
  assert.equal(session.activeProjectileCount, 0);
  session.dispose();
});

test('disparo fora do volume não reduz resistência nem é consumido', () => {
  const config = createGameplayConfig();
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config,
    enemyRandom: () => 0,
  });

  session.projectileSystem.spawn({
    origin: new Vector3(0, config.enemy.spawn.height, 5),
    direction: new Vector3(1, 0, 0),
    speed: 24,
  });
  session.update(0.25);

  assert.equal(session.enemyState.resistance, 1);
  assert.equal(session.enemyState.outcome, null);
  assert.equal(session.activeProjectileCount, 1);
  assert.equal(session.activeImpactFeedbackCount, 0);
  session.dispose();
});

test('contato com o jogador encerra o inimigo exatamente uma vez', () => {
  const contacts = [];
  const config = createGameplayConfig({
    enemy: {
      moveSpeed: 2,
      spawn: { minRadius: 3, maxRadius: 3 },
    },
  });
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config,
    enemyRandom: () => 0,
    onEnemyPlayerContact: (state) => contacts.push(state),
  });

  session.update(1);
  session.update(1);

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].outcome, 'player-contact');
  assert.equal(session.playerState.health, 99);
  assert.equal(session.enemyState.active, false);
  assert.equal(session.enemyState.outcome, 'player-contact');
  assertAlmostEqual(
    session.enemyState.distanceToPlayer,
    config.enemy.playerContactRadius,
  );
  assert.equal(session.enemySystem.parent, null);
  session.dispose();
});

test('contatos aplicam dano 1, 2 e 3 antes de notificar o desfecho', () => {
  const expectedHealth = [99, 98, 97];

  for (const [index, type] of GAMEPLAY_CONFIG.enemy.types.entries()) {
    const events = [];
    const config = createGameplayConfig({
      enemy: {
        moveSpeed: 2,
        spawn: { minRadius: 3, maxRadius: 3 },
        types: [{ ...type }],
      },
    });
    const session = new GameSession({
      camera: createCamera(),
      scene: new Scene(),
      config,
      enemyRandom: () => 0,
      onEnemyPlayerContact: (enemy) => {
        events.push({ kind: 'contact', state: enemy });
      },
      onPlayerHealthChange: (player) => {
        events.push({ kind: 'health', state: player });
      },
    });

    session.update(1);
    session.update(1);

    assert.deepEqual(
      events.map(({ kind }) => kind),
      ['health', 'contact'],
    );
    assert.equal(session.playerState.health, expectedHealth[index]);
    assert.equal(events[0].state.health, expectedHealth[index]);
    assert.equal(events[0].state.damage, type.damage);
    assert.equal(events[0].state.requestedDamage, type.damage);
    assert.equal(events[1].state.type.damage, type.damage);
    assert.equal(Object.isFrozen(events[0].state), true);
    assert.equal(Object.isFrozen(events[1].state), true);
    session.dispose();
  }
});

test('impacto anterior ao contato vence no mesmo frame', () => {
  const contacts = [];
  const eliminations = [];
  const config = createGameplayConfig({
    enemy: {
      moveSpeed: 2,
      spawn: { minRadius: 3, maxRadius: 3 },
    },
  });
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config,
    enemyRandom: () => 0,
    onEnemyEliminate: (state) => eliminations.push(state),
    onEnemyPlayerContact: (state) => contacts.push(state),
  });

  spawnShotAlongPositiveX(session, { speed: 4 });
  session.update(1);

  assert.equal(eliminations.length, 1);
  assert.equal(contacts.length, 0);
  assert.equal(session.enemyState.outcome, 'eliminated');
  assert.equal(session.activeProjectileCount, 0);
  assert.equal(session.playerState.health, 100);
  session.dispose();
});

test('impacto na mesma fração temporal do contato tem precedência', () => {
  const contacts = [];
  const eliminations = [];
  const config = createGameplayConfig({
    enemy: {
      moveSpeed: 2,
      spawn: { minRadius: 3, maxRadius: 3 },
    },
  });
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config,
    enemyRandom: () => 0,
    onEnemyEliminate: (state) => eliminations.push(state),
    onEnemyPlayerContact: (state) => contacts.push(state),
  });

  // Em t = 0,75, o inimigo chega a x = 1,5 e o projétil a x = 0,27.
  // A separação 1,23 é exatamente a soma dos raios 1,05 e 0,18.
  spawnShotAlongPositiveX(session, { speed: 0.36 });
  session.update(1);

  assert.equal(eliminations.length, 1);
  assert.equal(contacts.length, 0);
  assert.equal(session.enemyState.outcome, 'eliminated');
  assert.equal(session.activeProjectileCount, 0);
  assert.equal(session.playerState.health, 100);
  session.dispose();
});

test('impacto não letal no empate reduz resistência antes de resolver contato', () => {
  const contacts = [];
  const eliminations = [];
  const hits = [];
  const config = createGameplayConfig({
    enemy: {
      moveSpeed: 2,
      spawn: { minRadius: 3, maxRadius: 3 },
      types: [{ ...GAMEPLAY_CONFIG.enemy.types[1] }],
    },
  });
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config,
    enemyRandom: () => 0,
    onEnemyEliminate: (state) => eliminations.push(state),
    onEnemyHit: (state) => hits.push(state),
    onEnemyPlayerContact: (state) => contacts.push(state),
  });

  spawnShotAlongPositiveX(session, { speed: 0.36 });
  session.update(1);

  assert.equal(hits.length, 1);
  assert.equal(hits[0].outcome, null);
  assert.equal(hits[0].resistance, 1);
  assert.equal(hits[0].type.id, 'medium');
  assert.equal(eliminations.length, 0);
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].resistance, 1);
  assert.equal(contacts[0].type.id, 'medium');
  assert.equal(session.enemyState.outcome, 'player-contact');
  assert.equal(session.activeProjectileCount, 0);
  assert.equal(session.playerState.health, 98);
  session.dispose();
});

test('mantém o tempo global ao testar impacto no trecho anterior ao contato', () => {
  const contacts = [];
  const eliminations = [];
  const config = createGameplayConfig({
    enemy: {
      moveSpeed: 4,
      spawn: { minRadius: 3, maxRadius: 3 },
    },
  });
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config,
    enemyRandom: () => 0,
    onEnemyEliminate: (state) => eliminations.push(state),
    onEnemyPlayerContact: (state) => contacts.push(state),
  });

  spawnShotAlongPositiveX(session, { speed: 1 });
  session.update(1);

  assert.equal(session.enemyState.outcome, 'eliminated');
  assert.equal(eliminations.length, 1);
  assertAlmostEqual(
    eliminations[0].distanceToPlayer,
    session.enemyState.distanceToPlayer,
  );
  assert.equal(contacts.length, 0);
  assert.equal(session.activeProjectileCount, 0);
  assert.equal(session.playerState.health, 100);
  session.dispose();
});

test('contato anterior ao impacto vence no mesmo frame', () => {
  const contacts = [];
  const hits = [];
  const config = createGameplayConfig({
    enemy: {
      moveSpeed: 2,
      spawn: { minRadius: 3, maxRadius: 3 },
    },
  });
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config,
    enemyRandom: () => 0,
    onEnemyHit: (hit) => hits.push(hit),
    onEnemyPlayerContact: (state) => contacts.push(state),
  });

  spawnShotAlongPositiveX(session, { originX: -5, speed: 6 });
  session.update(1);

  assert.equal(contacts.length, 1);
  assert.equal(hits.length, 0);
  assert.equal(session.enemyState.outcome, 'player-contact');
  assert.equal(session.activeProjectileCount, 1);
  assert.equal(session.playerState.health, 99);
  session.dispose();
});

test('consome projétil antes de propagar falha de observador', () => {
  for (const callback of [
    'onEnemyResistanceChange',
    'onEnemyHit',
    'onEnemyEliminate',
  ]) {
    const failure = new Error(`falha em ${callback}`);
    const session = new GameSession({
      camera: createCamera(),
      scene: new Scene(),
      config: createGameplayConfig(),
      enemyRandom: () => 0,
      [callback]: () => {
        throw failure;
      },
    });

    spawnShotAlongPositiveX(session);
    assert.throws(() => session.update(0.5), failure);
    assert.equal(session.enemyState.outcome, 'eliminated');
    assert.equal(session.activeProjectileCount, 0);
    assert.equal(session.activeImpactFeedbackCount, 1);
    session.update(0.01);
    session.dispose();
  }
});

test('mantém contato terminal antes de propagar falha do observador', () => {
  const failure = new Error('falha no contato');
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: createGameplayConfig({
      enemy: {
        moveSpeed: 2,
        spawn: { minRadius: 3, maxRadius: 3 },
      },
    }),
    enemyRandom: () => 0,
    onEnemyPlayerContact: () => {
      throw failure;
    },
  });

  assert.throws(() => session.update(1), failure);
  assert.equal(session.enemyState.outcome, 'player-contact');
  assert.equal(session.playerState.health, 99);
  assert.equal(session.enemySystem.parent, null);
  session.update(0.01);
  session.dispose();
});

test('preserva dano e contato quando o observador da vida falha', () => {
  const failure = new Error('falha no observador da vida');
  const contacts = [];
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: createGameplayConfig({
      enemy: {
        moveSpeed: 2,
        spawn: { minRadius: 3, maxRadius: 3 },
        types: [{ ...GAMEPLAY_CONFIG.enemy.types[2] }],
      },
    }),
    enemyRandom: () => 0,
    onEnemyPlayerContact: (state) => contacts.push(state),
    onPlayerHealthChange: () => {
      throw failure;
    },
  });

  assert.throws(() => session.update(1), failure);
  assert.equal(session.playerState.health, 97);
  assert.equal(session.enemyState.outcome, 'player-contact');
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].type.damage, 3);
  assert.doesNotThrow(() => session.update(0.01));
  assert.equal(session.playerState.health, 97);
  session.dispose();
});

test('valida callbacks da sessão antes de criar recursos', () => {
  const scene = new Scene();

  for (const callback of [
    'onEnemyEliminate',
    'onEnemyHit',
    'onEnemyPlayerContact',
    'onWaveChange',
    'onPlayerHealthChange',
    'onScoreChange',
  ]) {
    assert.throws(
      () =>
        new GameSession({
          camera: createCamera(),
          scene,
          [callback]: null,
        }),
      new RegExp(`${callback} como função`),
    );
    assert.equal(scene.children.length, 0);
  }
});

test('remove recursos criados quando construção intermediária falha', () => {
  const scene = new Scene();

  assert.throws(
    () => new GameSession({ camera: null, scene }),
    /SlingshotSystem requer uma câmera/,
  );
  assert.equal(scene.getObjectByName('snowball-projectiles'), undefined);

  const invalidConfig = createGameplayConfig({
    enemy: { moveSpeed: 0 },
  });
  assert.throws(
    () =>
      new GameSession({
        camera: createCamera(),
        scene,
        config: invalidConfig,
      }),
    /moveSpeed.*positivo/,
  );
  assert.equal(scene.getObjectByName('snowball-projectiles'), undefined);
});
