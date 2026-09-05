import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MatchApiClient,
  MatchApiError,
  createMatchSubmission,
  createSubmissionId,
  formatMatchDuration,
  formatRankingDate,
  normalizeRankingPayload,
} from './match-api.js';

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

test('cria UUID v4 com randomUUID e fallback criptográfico', () => {
  const expected = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(createSubmissionId({ randomUUID: () => expected }), expected);

  const generated = createSubmissionId({
    getRandomValues: (bytes) => {
      bytes.fill(0xab);
      return bytes;
    },
  });

  assert.match(generated, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  assert.throws(() => createSubmissionId({}), /geração segura/);
});

test('consolida payload terminal imutável e duração mínima', () => {
  const input = {
    submissionId: '123e4567-e89b-42d3-a456-426614174000',
    playerName: '  Ana  ',
    score: 5400,
    scenario: 'Neve',
    result: 'victory',
    startedAt: 100,
    completedAt: 125.4,
  };
  const match = createMatchSubmission(input);

  assert.deepEqual(match, {
    submissionId: '123e4567-e89b-42d3-a456-426614174000',
    nome: 'Ana',
    pontuacao: 5400,
    cenario: 'neve',
    resultado: 'victory',
    duracaoMs: 25,
  });
  assert.equal(Object.isFrozen(match), true);
  assert.throws(
    () => createMatchSubmission({ ...input, startedAt: 10, completedAt: 5 }),
    /tempos/,
  );
});

test('envia partida com o contrato da API e aceita repetição idempotente', async () => {
  const calls = [];
  const client = new MatchApiClient({
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse({ duplicada: true, partida: { id: 7 } });
    },
  });
  const match = { submissionId: 'id', pontuacao: 100 };
  const result = await client.submitMatch(match);

  assert.equal(calls[0][0], '/api/partidas');
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][1].headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0][1].body), match);
  assert.deepEqual(result, { duplicate: true, match: { id: 7 } });
});

test('consulta e valida ranking por cenário', async () => {
  const calls = [];
  const payload = {
    ranking: [
      {
        posicao: 1,
        nome: 'Bia',
        pontuacao: 6800,
        cenario: 'neve',
        data: '2026-09-04T12:00:00.000Z',
      },
    ],
    total: 1,
  };
  const client = new MatchApiClient({
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse(payload);
    },
  });

  const result = await client.getRanking({ scenario: 'neve', limit: 10 });
  assert.equal(calls[0][0], '/api/ranking?cenario=neve&limite=10');
  assert.deepEqual(result, payload);
  assert.equal(Object.isFrozen(result.ranking[0]), true);
});

test('expõe erro HTTP controlado e rejeita respostas malformadas', async () => {
  const failingClient = new MatchApiClient({
    fetchImpl: async () =>
      jsonResponse(
        { error: 'Dados inválidos.', code: 'INVALID_MATCH', details: [] },
        { ok: false, status: 400 },
      ),
  });

  await assert.rejects(
    () => failingClient.submitMatch({}),
    (error) =>
      error instanceof MatchApiError &&
      error.status === 400 &&
      error.code === 'INVALID_MATCH',
  );

  assert.throws(
    () => normalizeRankingPayload({ ranking: [{ posicao: 0 }], total: 1 }),
    /entrada de ranking/,
  );
});

test('formata duração e data para a interface brasileira', () => {
  assert.equal(formatMatchDuration(125_000), '02:05');
  assert.equal(formatMatchDuration(0), '00:01');
  assert.throws(() => formatMatchDuration(Number.NaN), /duração/);
  assert.match(formatRankingDate('2026-09-04T12:00:00.000Z'), /04\/09\/2026/);
});
