import assert from 'node:assert/strict';
import test from 'node:test';

import { describePlayerHealth } from './player-hud.js';

test('descreve a vida inicial completa da Fase 10', () => {
  assert.deepEqual(
    describePlayerHealth({ health: 100, maxHealth: 100 }),
    {
      ariaText: 'Vida do jogador completa: 100 de 100',
      hudState: 'healthy',
      message: 'Vida completa. 100 de 100 pontos.',
      percent: 100,
      valueText: '100 / 100',
    },
  );
});

test('calcula a barra proporcional e distingue dano de vida esgotada', () => {
  const damaged = describePlayerHealth({ health: 97, maxHealth: 100 });
  const depleted = describePlayerHealth({ health: 0, maxHealth: 100 });

  assert.equal(damaged.hudState, 'damaged');
  assert.equal(damaged.percent, 97);
  assert.match(damaged.message, /Restam 97 de 100/);
  assert.equal(depleted.hudState, 'depleted');
  assert.equal(depleted.percent, 0);
  assert.match(depleted.ariaText, /esgotada/);
});

test('rejeita valores impossíveis de vida', () => {
  for (const state of [
    { health: 100, maxHealth: 0 },
    { health: -1, maxHealth: 100 },
    { health: 101, maxHealth: 100 },
    { health: Number.NaN, maxHealth: 100 },
  ]) {
    assert.throws(() => describePlayerHealth(state), /jogador|maxHealth/);
  }
});
