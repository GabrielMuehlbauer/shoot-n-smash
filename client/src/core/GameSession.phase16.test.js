import assert from 'node:assert/strict';
import test from 'node:test';

import { PerspectiveCamera, Scene, Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { GameSession } from './GameSession.js';

function createCamera() {
  const camera = new PerspectiveCamera(65, 1, 0.1, 120);
  camera.position.set(0, 1.35, 0);
  camera.lookAt(0, 1.35, -1);
  return camera;
}

function createConfig({ enemyType = 'weak' } = {}) {
  return {
    ...GAMEPLAY_CONFIG,
    projectile: {
      ...GAMEPLAY_CONFIG.projectile,
      gravity: 0,
      groundY: -100,
      lifetimeSeconds: 10,
    },
    waves: {
      interWaveDelaySeconds: 0,
      definitions: GAMEPLAY_CONFIG.waves.definitions.map((wave) => ({
        ...wave,
        enemyCount: 1,
        spawnIntervalSeconds: 0,
        moveSpeed: 1,
        typeIds: [enemyType],
      })),
    },
    items: {
      ...GAMEPLAY_CONFIG.items,
      lifetimeSeconds: 30,
      spawnChanceByWave: [1, 1, 1, 1],
      spawn: {
        ...GAMEPLAY_CONFIG.items.spawn,
        minRadius: 6,
        maxRadius: 6,
        height: 1.35,
      },
      animation: { ...GAMEPLAY_CONFIG.items.animation },
      types: GAMEPLAY_CONFIG.items.types.map((type) => ({
        ...type,
        effect: { ...type.effect },
      })),
    },
    boss: {
      ...GAMEPLAY_CONFIG.boss,
      spawnDelaySeconds: 0,
      type: { ...GAMEPLAY_CONFIG.boss.type },
    },
    enemy: {
      ...GAMEPLAY_CONFIG.enemy,
      playerPosition: { x: 0, y: 1.35, z: 0 },
      spawn: {
        ...GAMEPLAY_CONFIG.enemy.spawn,
        minRadius: 12,
        maxRadius: 12,
        height: 1.35,
      },
      animation: { ...GAMEPLAY_CONFIG.enemy.animation },
      colors: { ...GAMEPLAY_CONFIG.enemy.colors },
    },
  };
}

function sequence(values, fallback = 0) {
  let index = 0;
  return () => values[index++] ?? fallback;
}

function fireAtItem(session) {
  session.projectileSystem.spawn({
    origin: new Vector3(0, 1.35, 0),
    direction: new Vector3(0, 0, -1),
    speed: 20,
  });
  session.update(0.5);
}

test('coleta vida com um disparo, cura 20 e respeita o limite de 100', () => {
  const healthChanges = [];
  const collections = [];
  const itemChanges = [];
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: createConfig(),
    enemyRandom: () => 0,
    enemyTypeRandom: () => 0,
    itemRandom: sequence([0, 0, 0.5, 0]),
    onItemCollected: (state) => collections.push(state),
    onItemStateChange: (state) => itemChanges.push(state),
    onPlayerHealthChange: (state) => healthChanges.push(state),
  });

  assert.equal(session.itemState.active, true);
  assert.equal(session.itemState.type.id, 'health');
  session.playerHealthSystem.applyDamage(10);
  fireAtItem(session);

  assert.equal(session.playerState.health, 100);
  assert.equal(session.itemState.active, false);
  assert.equal(session.itemState.outcome, 'collected');
  assert.equal(session.activeProjectileCount, 0);
  assert.equal(session.enemyState.resistance, 1);
  assert.equal(collections.length, 1);
  assert.deepEqual(collections[0].effect, {
    kind: 'heal',
    requestedAmount: 20,
    appliedAmount: 10,
    health: 100,
  });
  assert.equal(healthChanges.at(-1).healing, 10);
  assert.deepEqual(
    itemChanges.map(({ active, outcome }) => ({ active, outcome })),
    [
      { active: true, outcome: null },
      { active: false, outcome: 'collected' },
    ],
  );
  session.dispose();
});

test('munição especial concede três tiros de dano 2 e consome um por disparo', () => {
  const ammoChanges = [];
  const collections = [];
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: createConfig({ enemyType: 'medium' }),
    enemyRandom: sequence([0.75, 0], 0.75),
    enemyTypeRandom: () => 0,
    itemRandom: sequence([0, 0.99, 0.5, 0]),
    onItemCollected: (state) => collections.push(state),
    onSpecialAmmoChange: (state) => ammoChanges.push(state),
  });

  assert.equal(session.itemState.type.id, 'special-ammo');
  fireAtItem(session);

  assert.deepEqual(session.specialAmmoState, {
    active: true,
    remainingShots: 3,
    maxShots: 6,
    hitStrength: 2,
  });
  assert.equal(collections[0].effect.addedShots, 3);
  assert.equal(session.enemyState.resistance, 2);

  session.beginCharge();
  const shot = session.releaseShot();
  assert.equal(shot.ammoType, 'special');
  assert.equal(shot.hitStrength, 2);
  assert.equal(session.specialAmmoState.remainingShots, 2);
  assert.deepEqual(
    ammoChanges.map(({ reason, remainingShots }) => ({ reason, remainingShots })),
    [
      { reason: 'collected', remainingShots: 3 },
      { reason: 'shot', remainingShots: 2 },
    ],
  );

  session.update(1.2);
  assert.equal(session.enemyState.outcome, 'eliminated');
  assert.equal(session.scoreState.score, 750);
  session.dispose();
});

test('tiros normais continuam com dano 1 quando não há munição especial', () => {
  const shots = [];
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: {
      ...createConfig({ enemyType: 'medium' }),
      items: {
        ...createConfig().items,
        spawnChanceByWave: [0, 0, 0, 0],
      },
    },
    enemyRandom: sequence([0.75, 0], 0.75),
    enemyTypeRandom: () => 0,
    itemRandom: () => 0.5,
    onShot: (shot) => shots.push(shot),
  });

  session.beginCharge();
  const shot = session.releaseShot();
  session.update(1.2);

  assert.equal(shot.ammoType, 'normal');
  assert.equal(shot.hitStrength, 1);
  assert.equal(shots.length, 1);
  assert.equal(session.enemyState.resistance, 1);
  assert.equal(session.specialAmmoState.active, false);
  session.dispose();
});

test('descarta item ativo ao iniciar o chefão e bloqueia coleta após resultado', () => {
  const hudFailure = new Error('falha simulada no HUD de itens');
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: createConfig(),
    enemyRandom: () => 0,
    enemyTypeRandom: () => 0,
    itemRandom: () => 0,
    onItemStateChange: (state) => {
      if (state.outcome === 'cleared') {
        throw hudFailure;
      }
    },
  });

  for (let wave = 1; wave <= 4; wave += 1) {
    session.enemySystem.applyHit(1);

    if (wave === 4) {
      assert.throws(() => session.update(0), (error) => error === hudFailure);
    } else {
      session.update(0);
    }
  }

  assert.equal(session.waveState.status, 'boss');
  assert.equal(session.itemState.active, false);
  assert.equal(session.itemState.outcome, 'cleared');

  session.enemySystem.applyHit(10);
  assert.equal(session.gameState.status, 'VICTORY');
  assert.equal(session.update(10), false);
  session.dispose();
});
