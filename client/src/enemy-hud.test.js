import assert from 'node:assert/strict';
import test from 'node:test';

import { describeEnemyState } from './enemy-hud.js';

const WEAK_TYPE = { id: 'weak', label: 'Fraco', damage: 1 };
const MEDIUM_TYPE = { id: 'medium', label: 'Médio', damage: 2 };
const RESISTANT_TYPE = { id: 'resistant', label: 'Resistente', damage: 3 };
const BOSS_TYPE = { id: 'boss', label: 'Chefão', damage: 10 };

test('descreve o tipo fraco ativo com dano da Fase 10', () => {
  assert.deepEqual(
    describeEnemyState({
      active: true,
      maxResistance: 1,
      outcome: null,
      resistance: 1,
      type: WEAK_TYPE,
    }),
    {
      ariaText: 'Inimigo fraco com 1 de 1 pontos de resistência',
      hudState: 'active',
      labelText: 'Inimigo fraco',
      message:
        'Inimigo fraco se aproximando. Localize-o em 360° e acerte antes do contato.',
      percent: 100,
      typeId: 'weak',
      typeLabel: 'Fraco',
      valueText: '1 / 1',
    },
  );
});

test('identifica tipos e calcula resistências intermediárias', () => {
  const medium = describeEnemyState({
    active: true,
    maxResistance: 2,
    outcome: null,
    resistance: 1,
    type: MEDIUM_TYPE,
  });
  const resistant = describeEnemyState({
    active: true,
    maxResistance: 3,
    outcome: null,
    resistance: 2,
    type: RESISTANT_TYPE,
  });

  assert.equal(medium.hudState, 'damaged');
  assert.equal(medium.percent, 50);
  assert.equal(medium.labelText, 'Inimigo médio');
  assert.match(medium.message, /Restam 1 de 2/);
  assert.equal(resistant.hudState, 'damaged');
  assert.equal(resistant.percent, 67);
  assert.equal(resistant.typeId, 'resistant');
  assert.match(resistant.ariaText, /Inimigo resistente com 2 de 3/);
});

test('distingue eliminação de contato com o jogador e preserva o tipo', () => {
  const eliminated = describeEnemyState({
    active: false,
    maxResistance: 3,
    outcome: 'eliminated',
    resistance: 0,
    type: RESISTANT_TYPE,
  });
  const playerContact = describeEnemyState({
    active: false,
    maxResistance: 2,
    outcome: 'player-contact',
    resistance: 1,
    type: MEDIUM_TYPE,
  });

  assert.equal(eliminated.hudState, 'eliminated');
  assert.match(eliminated.message, /resistente eliminado/i);
  assert.equal(playerContact.hudState, 'player-contact');
  assert.match(playerContact.message, /inimigo médio/i);
  assert.match(playerContact.message, /causou 2 de dano/i);
});

test('apresenta o chefão de gelo com resistência e dano próprios', () => {
  const active = describeEnemyState({
    active: true,
    maxResistance: 10,
    outcome: null,
    resistance: 10,
    type: BOSS_TYPE,
  });
  const damaged = describeEnemyState({
    active: true,
    maxResistance: 10,
    outcome: null,
    resistance: 1,
    type: BOSS_TYPE,
  });

  assert.equal(active.labelText, 'Chefão de gelo');
  assert.equal(active.valueText, '10 / 10');
  assert.match(active.message, /Chefão de gelo se aproximando/);
  assert.equal(damaged.percent, 10);
  assert.match(damaged.message, /Restam 1 de 10/);
});

test('rejeita estados impossíveis ou sem identidade de tipo', () => {
  assert.throws(
    () =>
      describeEnemyState({
        active: true,
        maxResistance: 1,
        outcome: null,
        resistance: 2,
        type: WEAK_TYPE,
      }),
    /entre zero e maxResistance/,
  );
  assert.throws(
    () =>
      describeEnemyState({
        active: false,
        maxResistance: 1,
        outcome: 'escaped',
        resistance: 1,
        type: WEAK_TYPE,
      }),
    /desfecho inválido/,
  );
  assert.throws(
    () =>
      describeEnemyState({
        active: true,
        maxResistance: 1,
        outcome: null,
        resistance: 1,
      }),
    /tipo com id, label e damage/,
  );
});
