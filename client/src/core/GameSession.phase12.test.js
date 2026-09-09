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
  const waveTypes = [
    ['weak'],
    ['medium'],
    ['resistant'],
    ['weak', 'medium', 'resistant'],
  ];

  return {
    ...GAMEPLAY_CONFIG,
    waves: {
      interWaveDelaySeconds: 0.5,
      definitions: waveTypes.map((typeIds, index) => ({
        number: index + 1,
        enemyCount: index === 0 ? 2 : 1,
        spawnIntervalSeconds: 0.2,
        moveSpeed: index + 1,
        typeIds,
      })),
    },
    boss: {
      ...GAMEPLAY_CONFIG.boss,
      spawnDelaySeconds: 0.3,
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

test('integra quatro ondas, tipos, velocidades e vida persistente', () => {
  const waveChanges = [];
  const typeSamples = [0, 0, 0, 0, 0.8];
  const scene = new Scene();
  const session = new GameSession({
    camera: createCamera(),
    scene,
    config: createConfig(),
    enemyRandom: () => 0,
    enemyTypeRandom: () => typeSamples.shift(),
    onWaveChange: (state) => waveChanges.push(state),
  });
  const enemyReference = session.enemySystem;
  const geometryReferences = [...session.enemySystem.geometries];

  assert.equal(session.waveState.wave, 1);
  assert.equal(session.waveState.enemy, 1);
  assert.equal(session.enemyState.type.id, 'weak');
  assert.equal(session.enemySystem.currentMoveSpeed, 1);

  session.enemySystem.applyHit(1);
  assert.equal(session.waveState.status, 'between-enemies');
  session.update(0.2);
  assert.equal(session.waveState.status, 'active');
  assert.equal(session.waveState.enemy, 2);
  assert.equal(session.enemySystem, enemyReference);
  assert.deepEqual([...session.enemySystem.geometries], geometryReferences);

  session.enemySystem.applyHit(1);
  assert.equal(session.waveState.wave, 2);
  assert.equal(session.waveState.status, 'between-waves');
  session.update(0.5);
  assert.equal(session.enemyState.type.id, 'medium');
  assert.equal(session.enemySystem.currentMoveSpeed, 2);

  session.enemySystem.applyHit(2);
  session.update(0.5);
  assert.equal(session.waveState.wave, 3);
  assert.equal(session.enemyState.type.id, 'resistant');
  assert.equal(session.enemySystem.currentMoveSpeed, 3);

  session.update(0.5);
  assert.equal(session.enemyState.outcome, 'player-contact');
  assert.equal(session.playerState.health, 85);
  assert.equal(session.waveState.wave, 4);
  assert.equal(session.waveState.status, 'between-waves');

  session.update(0.5);
  assert.equal(session.enemyState.type.id, 'resistant');
  assert.equal(session.enemySystem.currentMoveSpeed, 4);
  assert.equal(session.playerState.health, 85);
  session.enemySystem.applyHit(3);
  assert.equal(session.waveState.status, 'boss-pending');
  assert.equal(session.enemySystem.parent, null);
  assert.equal(session.playerState.health, 85);
  assert.equal(waveChanges.every(Object.isFrozen), true);
  assert.deepEqual(
    waveChanges.map(({ wave, enemy, status }) => [wave, enemy, status]),
    [
      [1, 2, 'between-enemies'],
      [1, 2, 'active'],
      [2, 1, 'between-waves'],
      [2, 1, 'active'],
      [3, 1, 'between-waves'],
      [3, 1, 'active'],
      [4, 1, 'between-waves'],
      [4, 1, 'active'],
      [4, 1, 'boss-pending'],
    ],
  );
  session.dispose();
});

test('pausa o intervalo da onda junto com o encontro', () => {
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: createConfig(),
    enemyRandom: () => 0,
    enemyTypeRandom: () => 0,
  });

  session.enemySystem.applyHit(1);
  session.setEncounterActive(false);
  session.update(10);
  assert.equal(session.waveState.status, 'between-enemies');
  assert.equal(session.waveState.remainingDelaySeconds, 0.2);

  session.setEncounterActive(true);
  session.update(0.2);
  assert.equal(session.waveState.status, 'active');
  assert.equal(session.enemyState.active, true);
  session.dispose();
});

test('cria um inimigo simultaneo por numero da onda e apenas um chefao', () => {
  const config = createConfig();
  config.waves.definitions = config.waves.definitions.map((wave, index) => ({
    ...wave,
    enemyCount: GAMEPLAY_CONFIG.waves.definitions[index].enemyCount,
    typeIds: ['weak'],
  }));
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config,
    enemyRandom: () => 0,
    enemyTypeRandom: () => 0,
  });

  const expectedGroups = [[1, 1, 1], [2, 2], [3, 2], [4, 2]];

  for (let wave = 1; wave <= 4; wave += 1) {
    assert.equal(session.waveState.wave, wave);
    const groups = expectedGroups[wave - 1];

    for (const [groupIndex, groupSize] of groups.entries()) {
      assert.equal(session.activeEnemyCount, groupSize);
      assert.equal(
        session.enemySystems.filter((enemy) => enemy.parent !== null).length,
        groupSize,
      );

      const activeGroup = session.enemySystems.filter((enemy) => enemy.active);
      for (const [index, enemy] of activeGroup.entries()) {
        enemy.applyHit(enemy.resistance);
        if (index < activeGroup.length - 1) {
          assert.equal(session.waveState.status, 'active');
        }
      }

      if (groupIndex < groups.length - 1) {
        assert.equal(session.waveState.status, 'between-enemies');
        session.update(config.waves.definitions[wave - 1].spawnIntervalSeconds);
      }
    }

    if (wave < 4) {
      assert.equal(session.waveState.status, 'between-waves');
      session.update(config.waves.interWaveDelaySeconds);
    }
  }

  assert.equal(session.waveState.status, 'boss-pending');
  assert.equal(session.activeEnemyCount, 0);
  session.update(config.boss.spawnDelaySeconds);
  assert.equal(session.waveState.status, 'boss');
  assert.equal(session.activeEnemyCount, 1);
  assert.equal(session.enemyState.type.id, 'boss');
  assert.equal(
    session.enemySystems.filter((enemy) => enemy.parent !== null).length,
    1,
  );
  session.dispose();
});

test('concede o bonus da onda somente quando todo o grupo foi resolvido', () => {
  const config = createConfig();
  config.waves.definitions = config.waves.definitions.map((wave) => ({
    ...wave,
    enemyCount: wave.number,
    typeIds: ['weak'],
  }));
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config,
    enemyRandom: () => 0,
    enemyTypeRandom: () => 0,
  });

  session.enemySystem.applyHit(1);
  session.update(config.waves.interWaveDelaySeconds);
  const [firstEnemy, secondEnemy] = session.enemySystems;

  secondEnemy.applyHit(1);
  assert.equal(session.waveState.status, 'active');
  assert.equal(session.scoreState.score, 700);

  firstEnemy.applyHit(1);
  assert.equal(session.waveState.status, 'between-waves');
  assert.equal(session.scoreState.score, 1300);
  session.dispose();
});

test('rejeita tipo de onda que nao existe no catalogo de inimigos', () => {
  const config = createConfig();
  config.waves.definitions[0].typeIds = ['ghost'];
  const scene = new Scene();

  assert.throws(
    () =>
      new GameSession({
        camera: createCamera(),
        scene,
        config,
      }),
    /typeId desconhecido/,
  );
  assert.equal(scene.children.length, 0);
});
