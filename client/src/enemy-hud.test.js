import assert from 'node:assert/strict';
import test from 'node:test';

import { describeEnemyState } from './enemy-hud.js';

test('descreve o inimigo ativo da Fase 8', () => {
  assert.deepEqual(
    describeEnemyState({
      active: true,
      maxResistance: 1,
      outcome: null,
      resistance: 1,
    }),
    {
      ariaText: 'Inimigo com 1 de 1 pontos de resistência',
      hudState: 'active',
      message:
        'Monstro de gelo se aproximando. Localize-o em 360° e acerte antes do contato.',
      percent: 100,
      valueText: '1 / 1',
    },
  );
});

test('mantém feedback genérico para resistências maiores', () => {
  const description = describeEnemyState({
    active: true,
    maxResistance: 3,
    outcome: null,
    resistance: 2,
  });

  assert.equal(description.hudState, 'damaged');
  assert.equal(description.percent, 67);
  assert.match(description.message, /Restam 2 de 3/);
});

test('distingue eliminação de contato com o jogador', () => {
  const eliminated = describeEnemyState({
    active: false,
    maxResistance: 1,
    outcome: 'eliminated',
    resistance: 0,
  });
  const playerContact = describeEnemyState({
    active: false,
    maxResistance: 1,
    outcome: 'player-contact',
    resistance: 1,
  });

  assert.equal(eliminated.hudState, 'eliminated');
  assert.match(eliminated.message, /eliminado/i);
  assert.equal(playerContact.hudState, 'player-contact');
  assert.match(playerContact.message, /sem reduzir vida/i);
});

test('rejeita estados impossíveis antes de atualizar o HUD', () => {
  assert.throws(
    () =>
      describeEnemyState({
        active: true,
        maxResistance: 1,
        outcome: null,
        resistance: 2,
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
      }),
    /desfecho inválido/,
  );
});
