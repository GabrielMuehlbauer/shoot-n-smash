import assert from 'node:assert/strict';
import test from 'node:test';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { PlayerHealthSystem } from './PlayerHealthSystem.js';

test('inicia com 100 de vida e expõe um snapshot imutável', () => {
  const player = new PlayerHealthSystem();

  assert.deepEqual(player.state, {
    health: 100,
    maxHealth: 100,
    ratio: 1,
    depleted: false,
  });
  assert.equal(Object.isFrozen(player.state), true);
  assert.deepEqual(GAMEPLAY_CONFIG.player, {
    initialHealth: 100,
    maxHealth: 100,
  });
  assert.equal(Object.isFrozen(GAMEPLAY_CONFIG.player), true);
});

test('aplica dano imediatamente e informa somente a perda efetiva', () => {
  const changes = [];
  const player = new PlayerHealthSystem({
    onHealthChange: (state) => changes.push(state),
  });

  const firstChange = player.applyDamage(1);
  const secondChange = player.applyDamage(2);
  const thirdChange = player.applyDamage(3);

  assert.deepEqual(
    changes.map(({ health, damage, requestedDamage }) => ({
      health,
      damage,
      requestedDamage,
    })),
    [
      { health: 99, damage: 1, requestedDamage: 1 },
      { health: 97, damage: 2, requestedDamage: 2 },
      { health: 94, damage: 3, requestedDamage: 3 },
    ],
  );
  assert.equal(firstChange.ratio, 0.99);
  assert.equal(secondChange.depleted, false);
  assert.equal(Object.isFrozen(thirdChange), true);
});

test('limita a vida em zero e ignora dano depois de esgotada', () => {
  const changes = [];
  const player = new PlayerHealthSystem({
    config: { initialHealth: 3, maxHealth: 100 },
    onHealthChange: (state) => changes.push(state),
  });

  const change = player.applyDamage(10);

  assert.deepEqual(change, {
    health: 0,
    maxHealth: 100,
    ratio: 0,
    depleted: true,
    damage: 3,
    requestedDamage: 10,
  });
  assert.equal(player.applyDamage(1), false);
  assert.equal(changes.length, 1);
  assert.equal(player.health, 0);
});

test('preserva a vida aplicada quando o observador falha', () => {
  const failure = new Error('falha simulada no HUD');
  const player = new PlayerHealthSystem({
    onHealthChange: () => {
      throw failure;
    },
  });

  assert.throws(() => player.applyDamage(3), failure);
  assert.equal(player.state.health, 97);
  assert.equal(player.state.ratio, 0.97);
});

test('rejeita configurações e valores de dano inválidos', () => {
  for (const config of [
    { initialHealth: 0, maxHealth: 0 },
    { initialHealth: 100, maxHealth: 99 },
    { initialHealth: -1, maxHealth: 100 },
    { initialHealth: 1.5, maxHealth: 100 },
  ]) {
    assert.throws(() => new PlayerHealthSystem({ config }), /player\./);
  }

  assert.throws(
    () => new PlayerHealthSystem({ onHealthChange: null }),
    /onHealthChange como função/,
  );

  const player = new PlayerHealthSystem();

  for (const damage of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => player.applyDamage(damage), /inteiro positivo/);
  }
  assert.equal(player.health, 100);
});

test('reset restaura a vida inicial e dispose é idempotente', () => {
  const player = new PlayerHealthSystem();

  player.applyDamage(3);
  assert.equal(player.reset(), true);
  assert.equal(player.health, 100);
  assert.equal(player.dispose(), true);
  assert.equal(player.dispose(), false);
  assert.equal(player.reset(), false);
  assert.throws(() => player.applyDamage(1), /descartado/);
});
