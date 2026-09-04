import assert from 'node:assert/strict';
import test from 'node:test';

import { GAME_STATES } from './gameplay/GameStateManager.js';
import {
  DEFAULT_PLAYER_NAME,
  PLAYER_NAME_MAX_LENGTH,
  describeMatchResult,
  normalizePlayerName,
} from './result-screen.js';

test('normaliza o nome e usa fallback seguro quando estiver vazio', () => {
  assert.equal(normalizePlayerName('  Ana   da Silva  '), 'Ana da Silva');
  assert.equal(normalizePlayerName('   '), DEFAULT_PLAYER_NAME);
  assert.equal(normalizePlayerName(null), DEFAULT_PLAYER_NAME);
  assert.equal(
    Array.from(normalizePlayerName('A'.repeat(40))).length,
    PLAYER_NAME_MAX_LENGTH,
  );
});

test('descreve vitoria com todos os campos obrigatorios', () => {
  assert.deepEqual(
    describeMatchResult({
      gameState: { status: GAME_STATES.VICTORY },
      playerName: '  Bia  ',
      scenario: 'Neve',
      score: 5700,
    }),
    {
      kind: 'victory',
      eyebrow: 'Região de neve concluída',
      title: 'Vitória!',
      message: 'Você sobreviveu às quatro ondas e derrotou o chefão de gelo.',
      playerName: 'Bia',
      resultText: 'Vitória',
      scenario: 'Neve',
      scoreText: '5.700',
    },
  );
});

test('descreve derrota sem confundir pontuacao acumulada', () => {
  const result = describeMatchResult({
    gameState: GAME_STATES.GAME_OVER,
    playerName: '',
    scenario: 'Neve',
    score: 1250,
  });

  assert.equal(result.kind, 'defeat');
  assert.equal(result.title, 'Fim de jogo');
  assert.equal(result.resultText, 'Derrota');
  assert.equal(result.playerName, DEFAULT_PLAYER_NAME);
  assert.equal(result.scoreText, '1.250');
  assert.equal(Object.isFrozen(result), true);
});

test('rejeita resultados incompletos ou nao terminais', () => {
  assert.throws(
    () => describeMatchResult({ gameState: GAME_STATES.PLAYING }),
    /estado terminal/,
  );
  assert.throws(
    () =>
      describeMatchResult({
        gameState: GAME_STATES.VICTORY,
        playerName: 'Ana',
        scenario: '',
        score: 0,
      }),
    /cenário/,
  );
  assert.throws(
    () =>
      describeMatchResult({
        gameState: GAME_STATES.GAME_OVER,
        playerName: 'Ana',
        scenario: 'Neve',
        score: -1,
      }),
    /pontuação/,
  );
  assert.throws(
    () => normalizePlayerName('Ana', { maxLength: 0 }),
    /limite do nome/,
  );
});
