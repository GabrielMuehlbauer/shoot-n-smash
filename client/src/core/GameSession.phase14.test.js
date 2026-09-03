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
  const typeIds = ['weak', 'medium', 'resistant', 'weak'];

  return {
    ...GAMEPLAY_CONFIG,
    waves: {
      interWaveDelaySeconds: 0,
      definitions: typeIds.map((typeId, index) => ({
        number: index + 1,
        enemyCount: 1,
        spawnIntervalSeconds: 0,
        moveSpeed: 1,
        typeIds: [typeId],
      })),
    },
    boss: {
      ...GAMEPLAY_CONFIG.boss,
      spawnDelaySeconds: 0,
      type: { ...GAMEPLAY_CONFIG.boss.type },
    },
    score: {
      ...GAMEPLAY_CONFIG.score,
      enemyElimination: { ...GAMEPLAY_CONFIG.score.enemyElimination },
    },
    enemy: {
      ...GAMEPLAY_CONFIG.enemy,
      playerPosition: { ...GAMEPLAY_CONFIG.enemy.playerPosition },
      spawn: { ...GAMEPLAY_CONFIG.enemy.spawn },
      animation: { ...GAMEPLAY_CONFIG.enemy.animation },
      colors: { ...GAMEPLAY_CONFIG.enemy.colors },
    },
  };
}

function spawnNext(session) {
  session.update(0);
  assert.equal(session.enemyState.active, true);
}

test('pontua eliminacoes, ondas, chefao e fase com os valores configurados', () => {
  const scoreChanges = [];
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: createConfig(),
    enemyRandom: () => 0,
    enemyTypeRandom: () => 0,
    onScoreChange: (state) => scoreChanges.push(state),
  });

  assert.deepEqual(session.scoreState, {
    score: 0,
    eventCount: 0,
    lastEvent: null,
  });

  session.enemySystem.applyHit(1);
  assert.equal(session.scoreState.score, 600);
  spawnNext(session);
  assert.equal(session.enemyState.type.id, 'medium');

  session.update(20);
  assert.equal(session.enemyState.outcome, 'player-contact');
  assert.equal(session.scoreState.score, 1100);
  spawnNext(session);

  session.enemySystem.applyHit(3);
  assert.equal(session.scoreState.score, 2100);
  spawnNext(session);

  session.enemySystem.applyHit(1);
  assert.equal(session.scoreState.score, 2700);
  spawnNext(session);
  assert.equal(session.enemyState.type.id, 'boss');

  session.enemySystem.applyHit(10);
  assert.equal(session.scoreState.score, 5700);
  assert.equal(session.scoreState.eventCount, 9);
  assert.deepEqual(
    scoreChanges.map(({ score }) => score),
    [100, 600, 1100, 1600, 2100, 2200, 2700, 4700, 5700],
  );
  assert.equal(scoreChanges.every(Object.isFrozen), true);
  session.dispose();
});

test('contato do chefao nao concede pontos de eliminacao nem de fase', () => {
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: createConfig(),
    enemyRandom: () => 0,
    enemyTypeRandom: () => 0,
  });

  for (let wave = 1; wave <= 4; wave += 1) {
    session.update(20);
    assert.equal(session.enemyState.outcome, 'player-contact');
    spawnNext(session);
  }

  assert.equal(session.waveState.status, 'boss');
  assert.equal(session.scoreState.score, 2000);
  session.update(30);
  assert.equal(session.enemyState.outcome, 'player-contact');
  assert.equal(session.waveState.status, 'complete');
  assert.equal(session.scoreState.score, 2000);
  assert.equal(session.scoreState.eventCount, 4);
  session.dispose();
});

test('falha no observador nao duplica nem impede os demais premios do desfecho', () => {
  const failure = new Error('falha na pontuacao');
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: createConfig(),
    enemyRandom: () => 0,
    enemyTypeRandom: () => 0,
    onScoreChange: () => {
      throw failure;
    },
  });

  assert.throws(() => session.enemySystem.applyHit(1), failure);
  assert.equal(session.scoreState.score, 600);
  assert.equal(session.scoreState.eventCount, 2);
  session.handleEnemyEliminate(session.enemyState);
  assert.equal(session.scoreState.score, 600);
  session.dispose();
});

test('rejeita configuracao de pontos invalida sem deixar recursos na cena', () => {
  const config = createConfig();
  config.score.waveCompleted = -1;
  const scene = new Scene();

  assert.throws(
    () => new GameSession({ camera: createCamera(), scene, config }),
    /waveCompleted/,
  );
  assert.equal(scene.children.length, 0);
});
