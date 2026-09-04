import assert from 'node:assert/strict';
import test from 'node:test';

import { PerspectiveCamera, Scene } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { GameSession } from './GameSession.js';

function createCamera() {
  const camera = new PerspectiveCamera(65, 1, 0.1, 120);
  camera.position.set(0, 1.65, 0);
  camera.lookAt(0, 1.65, -1);
  return camera;
}

function createConfig() {
  return {
    ...GAMEPLAY_CONFIG,
    waves: {
      interWaveDelaySeconds: 0.1,
      definitions: GAMEPLAY_CONFIG.waves.definitions.map((wave) => ({
        ...wave,
        enemyCount: 1,
        spawnIntervalSeconds: 0.05,
        typeIds: ['weak'],
      })),
    },
    boss: {
      ...GAMEPLAY_CONFIG.boss,
      spawnDelaySeconds: 0.2,
      moveSpeed: 2,
      radius: 2,
      visualScale: 2.5,
      spawnHeight: 2,
      type: { ...GAMEPLAY_CONFIG.boss.type },
    },
    enemy: {
      ...GAMEPLAY_CONFIG.enemy,
      playerPosition: { ...GAMEPLAY_CONFIG.enemy.playerPosition },
      spawn: {
        ...GAMEPLAY_CONFIG.enemy.spawn,
        minRadius: 3,
        maxRadius: 3,
      },
      animation: { ...GAMEPLAY_CONFIG.enemy.animation },
      colors: { ...GAMEPLAY_CONFIG.enemy.colors },
    },
  };
}

function finishFourWaves(session) {
  for (let wave = 1; wave <= 4; wave += 1) {
    session.enemySystem.applyHit(session.enemySystem.resistance);

    if (wave < 4) {
      assert.equal(session.waveState.status, 'between-waves');
      session.update(0.1);
    }
  }

  assert.equal(session.waveState.status, 'boss-pending');
}

test('configura o chefao com dez acertos, dano dez e escala gigante', () => {
  const { boss } = GAMEPLAY_CONFIG;

  assert.equal(Object.isFrozen(boss), true);
  assert.equal(Object.isFrozen(boss.type), true);
  assert.equal(boss.type.id, 'boss');
  assert.equal(boss.type.maxResistance, 10);
  assert.equal(boss.type.damage, 10);
  assert.ok(boss.visualScale > 2);
  assert.ok(boss.radius > GAMEPLAY_CONFIG.enemy.radius);
});

test('inicia o chefao apos a quarta onda e exige exatamente dez acertos', () => {
  const waveChanges = [];
  const scene = new Scene();
  const session = new GameSession({
    camera: createCamera(),
    scene,
    config: createConfig(),
    enemyRandom: () => 0,
    enemyTypeRandom: () => 0,
    onWaveChange: (state) => waveChanges.push(state),
  });
  const enemyReference = session.enemySystem;
  const geometryReferences = [...session.enemySystem.geometries];

  finishFourWaves(session);
  session.update(0.19);
  assert.equal(session.enemySystem.parent, null);
  session.update(0.02);

  assert.equal(session.waveState.status, 'boss');
  assert.equal(session.enemySystem, enemyReference);
  assert.deepEqual([...session.enemySystem.geometries], geometryReferences);
  assert.equal(session.enemySystem.parent, scene);
  assert.equal(session.enemyState.type.id, 'boss');
  assert.equal(session.enemyState.type.label, 'Chefão');
  assert.equal(session.enemyState.type.damage, 10);
  assert.equal(session.enemyState.maxResistance, 10);
  assert.equal(session.enemyState.resistance, 10);
  assert.equal(session.enemySystem.radius, 2);
  assert.equal(session.enemySystem.currentMoveSpeed, 2);
  assert.equal(session.enemySystem.currentSpawnHeight, 2);
  assert.equal(session.enemySystem.visual.scale.x, 2.5);

  for (let hit = 1; hit <= 9; hit += 1) {
    assert.equal(session.enemySystem.applyHit(1), true);
    assert.equal(session.enemyState.resistance, 10 - hit);
    assert.equal(session.enemyState.active, true);
    assert.equal(session.waveState.status, 'boss');
  }

  assert.equal(session.enemySystem.applyHit(1), true);
  assert.equal(session.enemyState.resistance, 0);
  assert.equal(session.enemyState.outcome, 'eliminated');
  assert.equal(session.waveState.status, 'complete');
  assert.equal(session.enemySystem.parent, null);
  session.update(10);
  assert.equal(session.enemySystem.parent, null);
  assert.equal(waveChanges.at(-2).status, 'boss');
  assert.equal(waveChanges.at(-1).status, 'complete');
  session.dispose();
});

test('contato do chefao causa dez de dano e reagenda o confronto', () => {
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: createConfig(),
    enemyRandom: () => 0,
    enemyTypeRandom: () => 0,
  });

  finishFourWaves(session);
  session.update(0.2);
  assert.equal(session.waveState.status, 'boss');
  session.update(0.75);

  assert.equal(session.enemyState.outcome, 'player-contact');
  assert.equal(session.playerState.health, 90);
  assert.equal(session.waveState.status, 'boss-pending');
  session.update(0.19);
  assert.equal(session.playerState.health, 90);
  assert.equal(session.enemySystem.parent, null);
  session.update(0.02);
  assert.equal(session.waveState.status, 'boss');
  assert.equal(session.enemyState.type.id, 'boss');
  assert.equal(session.enemyState.outcome, null);
  assert.equal(session.enemyState.resistance, 10);
  assert.equal(session.playerState.health, 90);
  session.dispose();
});

test('rejeita configuracoes invalidas do chefao antes de criar recursos', () => {
  const base = createConfig();
  const invalidBosses = [
    { ...base.boss, moveSpeed: 0 },
    { ...base.boss, radius: 0 },
    { ...base.boss, visualScale: 0 },
    { ...base.boss, spawnHeight: -1 },
    { ...base.boss, type: { ...base.boss.type, maxResistance: 0 } },
  ];

  for (const boss of invalidBosses) {
    const scene = new Scene();
    assert.throws(
      () =>
        new GameSession({
          camera: createCamera(),
          scene,
          config: { ...base, boss },
        }),
      /boss|maxResistance/,
    );
    assert.equal(scene.children.length, 0);
  }
});
