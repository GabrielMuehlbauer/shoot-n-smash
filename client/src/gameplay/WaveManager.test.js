import assert from 'node:assert/strict';
import test from 'node:test';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { WaveManager, validateWaveConfig } from './WaveManager.js';

function createWaveConfig() {
  return {
    interWaveDelaySeconds: 1,
    definitions: [
      {
        number: 1,
        enemyCount: 2,
        spawnIntervalSeconds: 0.5,
        moveSpeed: 1,
        typeIds: ['weak'],
      },
      {
        number: 2,
        enemyCount: 1,
        spawnIntervalSeconds: 0.4,
        moveSpeed: 2,
        typeIds: ['weak', 'medium'],
      },
      {
        number: 3,
        enemyCount: 1,
        spawnIntervalSeconds: 0.3,
        moveSpeed: 3,
        typeIds: ['medium', 'resistant'],
      },
      {
        number: 4,
        enemyCount: 1,
        spawnIntervalSeconds: 0.2,
        moveSpeed: 4,
        typeIds: ['weak', 'medium', 'resistant'],
      },
    ],
  };
}

test('configura quatro ondas com dificuldade progressiva e dados imutaveis', () => {
  const { definitions } = GAMEPLAY_CONFIG.waves;

  assert.equal(Object.isFrozen(GAMEPLAY_CONFIG.waves), true);
  assert.equal(Object.isFrozen(definitions), true);
  assert.deepEqual(definitions.map(({ enemyCount }) => enemyCount), [3, 4, 5, 6]);
  assert.deepEqual(definitions.map(({ moveSpeed }) => moveSpeed), [1.15, 1.25, 1.4, 1.6]);
  assert.deepEqual(
    definitions.map(({ spawnIntervalSeconds }) => spawnIntervalSeconds),
    [1.25, 1.1, 0.95, 0.8],
  );
  assert.deepEqual(definitions[0].typeIds, ['weak']);
  assert.deepEqual(definitions[1].typeIds, ['weak', 'medium']);
  assert.deepEqual(definitions[3].typeIds, ['weak', 'medium', 'resistant']);
  assert.equal(definitions.every(Object.isFrozen), true);
  assert.equal(definitions.every(({ typeIds }) => Object.isFrozen(typeIds)), true);
});

test('avanca inimigos e ondas respeitando os dois tipos de intervalo', () => {
  const manager = new WaveManager({
    config: createWaveConfig(),
    bossDelaySeconds: 0.75,
  });

  assert.deepEqual(manager.state, {
    wave: 1,
    totalWaves: 4,
    enemy: 1,
    enemiesInWave: 2,
    status: 'active',
    remainingDelaySeconds: 0,
    moveSpeed: 1,
    typeIds: ['weak'],
  });
  assert.equal(Object.isFrozen(manager.state), true);
  assert.equal(Object.isFrozen(manager.state.typeIds), true);

  assert.equal(manager.completeEnemy(), true);
  assert.equal(manager.state.status, 'between-enemies');
  assert.equal(manager.state.enemy, 2);
  assert.deepEqual(manager.update(0.25), { enemyDelta: 0, spawnKind: null });
  assert.equal(manager.state.remainingDelaySeconds, 0.25);
  const respawn = manager.update(0.3);
  assert.equal(respawn.spawnKind, 'enemy');
  assert.ok(Math.abs(respawn.enemyDelta - 0.05) < 1e-10);
  assert.equal(manager.state.status, 'active');

  manager.completeEnemy();
  assert.equal(manager.state.wave, 2);
  assert.equal(manager.state.enemy, 1);
  assert.equal(manager.state.status, 'between-waves');
  assert.equal(manager.state.remainingDelaySeconds, 1);
  assert.deepEqual(manager.spawnSettings, {
    moveSpeed: 2,
    typeIds: ['weak', 'medium'],
  });
  assert.deepEqual(manager.update(1.25), {
    enemyDelta: 0.25,
    spawnKind: 'enemy',
  });

  manager.completeEnemy();
  manager.update(1);
  manager.completeEnemy();
  manager.update(1);
  manager.completeEnemy();
  assert.equal(manager.state.wave, 4);
  assert.equal(manager.state.status, 'boss-pending');
  assert.equal(manager.state.remainingDelaySeconds, 0.75);
  assert.deepEqual(manager.update(1), {
    enemyDelta: 0.25,
    spawnKind: 'boss',
  });
  assert.equal(manager.state.status, 'boss');
  assert.equal(manager.completeEnemy(), true);
  assert.equal(manager.state.status, 'complete');
  assert.equal(manager.completeEnemy(), false);
  assert.deepEqual(manager.update(10), { enemyDelta: 0, spawnKind: null });
});

test('pausa intervalos e reinicia no primeiro inimigo da primeira onda', () => {
  const manager = new WaveManager({ config: createWaveConfig() });

  manager.completeEnemy();
  assert.deepEqual(manager.update(10, { active: false }), {
    enemyDelta: 0,
    spawnKind: null,
  });
  assert.equal(manager.state.remainingDelaySeconds, 0.5);
  manager.update(0.5);
  manager.completeEnemy();
  assert.equal(manager.state.wave, 2);

  assert.equal(manager.reset(), true);
  assert.equal(manager.state.wave, 1);
  assert.equal(manager.state.enemy, 1);
  assert.equal(manager.state.status, 'active');
});

test('rejeita configuracoes, deltas e estados invalidos', () => {
  const valid = createWaveConfig();
  const invalidConfigs = [
    { ...valid, interWaveDelaySeconds: -1 },
    { ...valid, definitions: valid.definitions.slice(0, 3) },
    {
      ...valid,
      definitions: valid.definitions.map((wave, index) =>
        index === 0 ? { ...wave, number: 2 } : wave,
      ),
    },
    {
      ...valid,
      definitions: valid.definitions.map((wave, index) =>
        index === 0 ? { ...wave, enemyCount: 0 } : wave,
      ),
    },
    {
      ...valid,
      definitions: valid.definitions.map((wave, index) =>
        index === 0 ? { ...wave, spawnIntervalSeconds: -1 } : wave,
      ),
    },
    {
      ...valid,
      definitions: valid.definitions.map((wave, index) =>
        index === 0 ? { ...wave, moveSpeed: 0 } : wave,
      ),
    },
    {
      ...valid,
      definitions: valid.definitions.map((wave, index) =>
        index === 0 ? { ...wave, typeIds: ['weak', 'weak'] } : wave,
      ),
    },
  ];

  for (const config of invalidConfigs) {
    assert.throws(() => validateWaveConfig(config), /wave|onda/i);
  }

  const manager = new WaveManager({ config: valid });
  assert.throws(() => manager.update(-1), /delta/);
  assert.throws(() => manager.update(Number.NaN), /delta/);
  assert.throws(() => manager.update(1, { active: 'yes' }), /booleano/);
  assert.throws(
    () => new WaveManager({ config: valid, bossDelaySeconds: -1 }),
    /bossDelaySeconds/,
  );
});
