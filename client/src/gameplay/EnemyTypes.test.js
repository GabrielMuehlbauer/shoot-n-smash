import assert from 'node:assert/strict';
import test from 'node:test';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { selectEnemyType, validateEnemyTypes } from './EnemyTypes.js';

test('configura tipos normais com resistência, dano e altura crescentes', () => {
  assert.deepEqual(
    GAMEPLAY_CONFIG.enemy.types.map(
      ({ id, label, maxResistance, damage, visualScale }) => ({
        id,
        label,
        maxResistance,
        damage,
        visualScale,
      }),
    ),
    [
      {
        id: 'weak',
        label: 'Fraco',
        maxResistance: 1,
        damage: 5,
        visualScale: 0.78,
      },
      {
        id: 'medium',
        label: 'Médio',
        maxResistance: 2,
        damage: 10,
        visualScale: 1,
      },
      {
        id: 'resistant',
        label: 'Resistente',
        maxResistance: 3,
        damage: 15,
        visualScale: 1.25,
      },
    ],
  );
  assert.equal(Object.isFrozen(GAMEPLAY_CONFIG.enemy.types), true);
  assert.equal(
    GAMEPLAY_CONFIG.enemy.types.every((type) => Object.isFrozen(type)),
    true,
  );
});

test('seleciona os tipos uniformemente nas fronteiras dos três intervalos', () => {
  const cases = [
    [0, 'weak'],
    [1 / 3 - Number.EPSILON, 'weak'],
    [1 / 3, 'medium'],
    [2 / 3 - Number.EPSILON, 'medium'],
    [2 / 3, 'resistant'],
    [1 - Number.EPSILON, 'resistant'],
  ];

  for (const [value, expectedId] of cases) {
    assert.equal(selectEnemyType({ random: () => value }).id, expectedId);
  }
});

test('retorna um snapshot imutável independente do catálogo de origem', () => {
  const source = [
    {
      id: 'custom',
      label: 'Personalizado',
      maxResistance: 4,
      damage: 7,
      color: 0x123456,
    },
  ];
  const selected = selectEnemyType({ types: source, random: () => 0 });

  source[0].label = 'Alterado';
  source[0].maxResistance = 99;

  assert.deepEqual(selected, {
    id: 'custom',
    label: 'Personalizado',
    maxResistance: 4,
    damage: 7,
    color: 0x123456,
  });
  assert.equal(Object.isFrozen(selected), true);
});

test('rejeita catálogos, descritores e geradores inválidos', () => {
  assert.throws(() => validateEnemyTypes(), /lista não vazia/);
  assert.throws(() => validateEnemyTypes([]), /lista não vazia/);
  assert.throws(() => validateEnemyTypes([null]), /descritor de tipo/);
  assert.throws(
    () =>
      validateEnemyTypes([
        { id: '', label: 'Fraco', maxResistance: 1, damage: 1, color: 0 },
      ]),
    /\.id.*texto não vazio/,
  );
  assert.throws(
    () =>
      validateEnemyTypes([
        { id: 'weak', label: '', maxResistance: 1, damage: 1, color: 0 },
      ]),
    /\.label.*texto não vazio/,
  );
  assert.throws(
    () =>
      validateEnemyTypes([
        { id: ' weak ', label: 'Fraco', maxResistance: 1, damage: 1, color: 0 },
      ]),
    /\.id.*espaços externos/,
  );
  assert.throws(
    () =>
      validateEnemyTypes([
        { id: 'weak', label: ' Fraco ', maxResistance: 1, damage: 1, color: 0 },
      ]),
    /\.label.*espaços externos/,
  );
  assert.throws(
    () =>
      validateEnemyTypes([
        { id: 'weak', label: 'Fraco', maxResistance: 1.5, damage: 1, color: 0 },
      ]),
    /maxResistance.*inteiro positivo/,
  );
  assert.throws(
    () =>
      validateEnemyTypes([
        { id: 'weak', label: 'Fraco', maxResistance: 1, damage: 0, color: 0 },
      ]),
    /damage.*inteiro positivo/,
  );
  assert.throws(
    () =>
      validateEnemyTypes([
        { id: 'weak', label: 'Fraco', maxResistance: 1, damage: 1, color: 0x1000000 },
      ]),
    /color.*hexadecimal válida/,
  );
  assert.throws(
    () =>
      validateEnemyTypes([
        {
          id: 'weak',
          label: 'Fraco',
          maxResistance: 1,
          damage: 1,
          color: 0,
          visualScale: 0,
        },
      ]),
    /visualScale.*maior que zero/,
  );
  assert.throws(
    () =>
      validateEnemyTypes([
        { id: 'same', label: 'A', maxResistance: 1, damage: 1, color: 0 },
        { id: 'same', label: 'B', maxResistance: 2, damage: 2, color: 1 },
      ]),
    /id duplicado/,
  );
  assert.throws(
    () => selectEnemyType({ random: null }),
    /random como função/,
  );

  for (const value of [-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => selectEnemyType({ random: () => value }),
      /entre 0 e 1/,
    );
  }
});
