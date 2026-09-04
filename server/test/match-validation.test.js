import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MATCH_LIMITS,
  validateMatchPayload,
  validateRankingQuery,
} from '../src/matches/match-validation.js';

const VALID_PAYLOAD = Object.freeze({
  submissionId: '00000000-0000-4000-8000-000000000001',
  nome: '  Jogador   de Gelo  ',
  pontuacao: 6800,
  cenario: 'NEVE',
  resultado: 'victory',
  duracaoMs: 90_000,
});

test('normaliza uma partida concluída válida', () => {
  assert.deepEqual(validateMatchPayload(VALID_PAYLOAD), {
    submissionId: VALID_PAYLOAD.submissionId,
    playerName: 'Jogador de Gelo',
    playerKey: 'jogador de gelo',
    score: 6800,
    scenario: 'neve',
    result: 'victory',
    durationMs: 90_000,
  });
});

test('aceita duração ausente sem inventar um valor', () => {
  const { duracaoMs, ...payload } = VALID_PAYLOAD;
  assert.equal(validateMatchPayload(payload).durationMs, null);
});

test('rejeita corpo, campos e valores inválidos com detalhes seguros', () => {
  assert.throws(
    () => validateMatchPayload(null),
    (error) =>
      error.code === 'INVALID_MATCH' &&
      error.details[0].message.includes('objeto JSON'),
  );

  for (const overrides of [
    { submissionId: 'id-local' },
    { nome: '' },
    { nome: 'x'.repeat(MATCH_LIMITS.maxNameLength + 1) },
    { pontuacao: -1 },
    { pontuacao: MATCH_LIMITS.maxScore + 1 },
    { pontuacao: 10.5 },
    { cenario: 'vulcao' },
    { resultado: 'playing' },
    { duracaoMs: 0 },
    { duracaoMs: MATCH_LIMITS.maxDurationMs + 1 },
    { extra: true },
  ]) {
    assert.throws(
      () => validateMatchPayload({ ...VALID_PAYLOAD, ...overrides }),
      (error) =>
        error.status === 400 &&
        error.code === 'INVALID_MATCH' &&
        error.details.length >= 1,
    );
  }
});

test('normaliza filtros de ranking e aceita fase como alias de cenário', () => {
  assert.deepEqual(validateRankingQuery(), {
    scenario: null,
    limit: 10,
  });
  assert.deepEqual(validateRankingQuery({ fase: ' NEVE ', limite: '25' }), {
    scenario: 'neve',
    limit: 25,
  });
  assert.deepEqual(
    validateRankingQuery({ cenario: 'neve', fase: 'neve' }),
    { scenario: 'neve', limit: 10 },
  );
});

test('rejeita filtros desconhecidos, ambíguos ou fora dos limites', () => {
  for (const query of [
    { fase: 'vulcao' },
    { cenario: 'neve', fase: 'vulcao' },
    { limite: '0' },
    { limite: '10.5' },
    { limite: '101' },
    { extra: 'x' },
    { cenario: ['neve', 'neve'] },
  ]) {
    assert.throws(
      () => validateRankingQuery(query),
      (error) => error.status === 400 && error.code === 'INVALID_RANKING_FILTER',
    );
  }
});
