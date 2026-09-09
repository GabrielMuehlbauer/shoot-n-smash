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

function createConfig({ initialHealth = 100, bossDelaySeconds = 0 } = {}) {
  return {
    ...GAMEPLAY_CONFIG,
    player: {
      ...GAMEPLAY_CONFIG.player,
      initialHealth,
    },
    waves: {
      interWaveDelaySeconds: 0,
      definitions: GAMEPLAY_CONFIG.waves.definitions.map((wave) => ({
        ...wave,
        enemyCount: 1,
        spawnIntervalSeconds: 0,
        moveSpeed: 2,
        typeIds: ['weak'],
      })),
    },
    boss: {
      ...GAMEPLAY_CONFIG.boss,
      spawnDelaySeconds: bossDelaySeconds,
      moveSpeed: 2,
      type: { ...GAMEPLAY_CONFIG.boss.type },
    },
    score: {
      ...GAMEPLAY_CONFIG.score,
      enemyElimination: { ...GAMEPLAY_CONFIG.score.enemyElimination },
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

function createSession(options = {}) {
  return new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    config: createConfig(),
    enemyRandom: () => 0,
    enemyTypeRandom: () => 0,
    ...options,
  });
}

function reachBoss(session) {
  for (let wave = 1; wave <= 4; wave += 1) {
    assert.equal(session.enemySystem.applyHit(1), true);
    assert.equal(
      session.waveState.status,
      wave === 4 ? 'boss-pending' : 'between-waves',
    );
    session.update(
      wave === 4 ? session.config.boss.spawnDelaySeconds : 0,
    );
  }

  assert.equal(session.waveState.status, 'boss');
  assert.equal(session.enemyState.type.id, 'boss');
  assert.equal(session.enemyState.resistance, 10);
}

test('inicia em PLAYING sem resultado terminal', () => {
  const session = createSession();

  assert.deepEqual(session.gameState, {
    status: 'PLAYING',
    terminal: false,
    result: null,
  });
  assert.equal(Object.isFrozen(session.gameState), true);
  assert.equal(session.isTerminal, false);
  session.dispose();
});

test('declara vitoria no decimo impacto com a pontuacao final pronta antes do callback', () => {
  const changes = [];
  const scoresSeenByCallback = [];
  let session;

  session = createSession({
    onGameStateChange: (state) => {
      changes.push(state);
      scoresSeenByCallback.push(session.scoreState.score);
    },
  });
  reachBoss(session);

  for (let hit = 1; hit <= 9; hit += 1) {
    assert.equal(session.enemySystem.applyHit(1), true);
    assert.equal(session.gameState.status, 'PLAYING');
    assert.equal(changes.length, 0);
  }

  assert.equal(session.enemySystem.applyHit(1), true);
  assert.equal(session.scoreState.score, 5400);
  assert.equal(session.scoreState.eventCount, 10);
  assert.deepEqual(scoresSeenByCallback, [5400]);
  assert.deepEqual(changes, [
    {
      status: 'VICTORY',
      terminal: true,
      result: 'victory',
      previousStatus: 'PLAYING',
    },
  ]);
  assert.equal(Object.isFrozen(changes[0]), true);
  assert.equal(session.isTerminal, true);
  session.dispose();
});

test('declara derrota assim que a vida chega a zero', () => {
  const changes = [];
  const session = createSession({
    config: createConfig({ initialHealth: 1 }),
    onGameStateChange: (state) => changes.push(state),
  });

  assert.equal(session.update(1), true);
  assert.equal(session.playerState.health, 0);
  assert.equal(session.playerState.depleted, true);
  assert.deepEqual(session.gameState, {
    status: 'GAME_OVER',
    terminal: true,
    result: 'defeat',
  });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].previousStatus, 'PLAYING');
  session.dispose();
});

test('mantem o terminal idempotente e bloqueia update, carga e disparo', () => {
  const changes = [];
  const session = createSession({
    config: createConfig({ initialHealth: 1 }),
    onGameStateChange: (state) => changes.push(state),
  });

  session.update(1);
  const terminalState = session.gameState;
  const waveState = session.waveState;
  const scoreState = session.scoreState;

  assert.equal(session.syncGameState(), false);
  assert.equal(session.update(10), false);
  assert.equal(session.beginCharge(), false);
  assert.equal(session.releaseShot(), false);
  assert.deepEqual(session.gameState, terminalState);
  assert.deepEqual(session.waveState, waveState);
  assert.deepEqual(session.scoreState, scoreState);
  assert.equal(session.activeProjectileCount, 0);
  assert.equal(changes.length, 1);
  session.dispose();
});

test('contato nao letal do chefao reagenda o confronto e restaura resistencia total', () => {
  const session = createSession({
    config: createConfig({ bossDelaySeconds: 0.2 }),
  });
  reachBoss(session);
  session.enemySystem.applyHit(3);
  assert.equal(session.enemyState.resistance, 7);
  const scoreBeforeContact = session.scoreState.score;

  session.update(0.75);

  assert.equal(session.enemyState.outcome, 'player-contact');
  assert.equal(session.playerState.health, 75);
  assert.equal(session.waveState.status, 'boss-pending');
  assert.equal(session.gameState.status, 'PLAYING');
  assert.equal(session.scoreState.score, scoreBeforeContact);

  session.update(0.19);
  assert.equal(session.waveState.status, 'boss-pending');
  assert.equal(session.enemySystem.parent, null);
  session.update(0.02);

  assert.equal(session.waveState.status, 'boss');
  assert.equal(session.enemyState.type.id, 'boss');
  assert.equal(session.enemyState.outcome, null);
  assert.equal(session.enemyState.active, true);
  assert.equal(session.enemyState.resistance, 10);
  assert.equal(session.enemyState.maxResistance, 10);
  assert.equal(session.playerState.health, 75);
  assert.equal(session.gameState.status, 'PLAYING');
  session.dispose();
});

test('preserva o estado terminal quando o callback da transicao falha', () => {
  const failure = new Error('falha no resultado terminal');
  let callbackCalls = 0;
  const session = createSession({
    config: createConfig({ initialHealth: 1 }),
    onGameStateChange: () => {
      callbackCalls += 1;
      throw failure;
    },
  });

  assert.throws(
    () => session.update(1),
    (error) => error === failure,
  );
  assert.equal(session.playerState.health, 0);
  assert.deepEqual(session.gameState, {
    status: 'GAME_OVER',
    terminal: true,
    result: 'defeat',
  });
  assert.equal(session.update(1), false);
  assert.equal(callbackCalls, 1);
  session.dispose();
});
