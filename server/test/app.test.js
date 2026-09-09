import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

import { createApp } from '../src/app.js';

async function startTestServer(app, testContext) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  testContext.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

function createMatchPayload(overrides = {}) {
  return {
    submissionId: '00000000-0000-4000-8000-000000000001',
    nome: 'Jogador de Teste',
    pontuacao: 6800,
    cenario: 'neve',
    resultado: 'victory',
    duracaoMs: 120_000,
    ...overrides,
  };
}

async function postMatch(baseUrl, payload) {
  return fetch(`${baseUrl}/api/partidas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

test('GET /api/health funciona sem MySQL configurado', async (testContext) => {
  const baseUrl = await startTestServer(createApp(), testContext);
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.phase, 25);
  assert.equal(body.database.status, 'not-configured');
  assert.equal(body.storage.matches, 'memory');
});

test('rotas desconhecidas da API retornam JSON e status 404', async (testContext) => {
  const baseUrl = await startTestServer(createApp(), testContext);
  const response = await fetch(`${baseUrl}/api/inexistente`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error, 'Rota da API não encontrada.');
});

test('health informa indisponibilidade quando o MySQL configurado falha', async (testContext) => {
  const databasePool = {
    query: async () => {
      throw new Error('database unavailable');
    },
  };
  const baseUrl = await startTestServer(createApp({ databasePool }), testContext);
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.status, 'degraded');
  assert.equal(body.phase, 25);
  assert.equal(body.database.status, 'unavailable');
  assert.equal(body.storage.matches, 'mysql');
});

test('POST /api/partidas registra e repete a mesma submissão sem duplicar', async (testContext) => {
  const baseUrl = await startTestServer(createApp(), testContext);
  const firstResponse = await postMatch(baseUrl, createMatchPayload());
  const firstBody = await firstResponse.json();
  const duplicateResponse = await postMatch(baseUrl, createMatchPayload());
  const duplicateBody = await duplicateResponse.json();

  assert.equal(firstResponse.status, 201);
  assert.equal(firstBody.duplicada, false);
  assert.equal(firstBody.partida.id, 1);
  assert.equal(firstBody.partida.jogador.nome, 'Jogador de Teste');
  assert.equal(firstBody.partida.pontuacao, 6800);
  assert.match(firstBody.partida.data, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal(duplicateResponse.status, 200);
  assert.equal(duplicateBody.duplicada, true);
  assert.equal(duplicateBody.partida.id, firstBody.partida.id);
});

test('POST /api/partidas rejeita dados inválidos e conflitos', async (testContext) => {
  const baseUrl = await startTestServer(createApp(), testContext);
  const invalidResponse = await postMatch(
    baseUrl,
    createMatchPayload({ nome: '', pontuacao: -1 }),
  );
  const invalidBody = await invalidResponse.json();

  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidBody.code, 'INVALID_MATCH');
  assert.deepEqual(
    invalidBody.details.map(({ field }) => field),
    ['nome', 'pontuacao'],
  );

  await postMatch(baseUrl, createMatchPayload());
  const conflictResponse = await postMatch(
    baseUrl,
    createMatchPayload({ pontuacao: 7000 }),
  );
  const conflictBody = await conflictResponse.json();

  assert.equal(conflictResponse.status, 409);
  assert.equal(conflictBody.code, 'SUBMISSION_CONFLICT');
});

test('GET /api/ranking retorna o melhor resultado por jogador em ordem decrescente', async (testContext) => {
  const baseUrl = await startTestServer(createApp(), testContext);

  await postMatch(baseUrl, createMatchPayload({ pontuacao: 500 }));
  await postMatch(
    baseUrl,
    createMatchPayload({
      submissionId: '00000000-0000-4000-8000-000000000002',
      pontuacao: 900,
    }),
  );
  await postMatch(
    baseUrl,
    createMatchPayload({
      submissionId: '00000000-0000-4000-8000-000000000003',
      nome: 'Outro jogador',
      pontuacao: 700,
      resultado: 'defeat',
    }),
  );

  const response = await fetch(`${baseUrl}/api/ranking?fase=neve&limite=10`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.total, 2);
  assert.deepEqual(
    body.ranking.map(({ posicao, nome, pontuacao, cenario }) => ({
      posicao,
      nome,
      pontuacao,
      cenario,
    })),
    [
      {
        posicao: 1,
        nome: 'Jogador de Teste',
        pontuacao: 900,
        cenario: 'neve',
      },
      {
        posicao: 2,
        nome: 'Outro jogador',
        pontuacao: 700,
        cenario: 'neve',
      },
    ],
  );
});

test('GET /api/ranking valida filtros antes de consultar o serviço', async (testContext) => {
  const baseUrl = await startTestServer(createApp(), testContext);
  const response = await fetch(`${baseUrl}/api/ranking?cenario=vulcao&limite=0`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.code, 'INVALID_RANKING_FILTER');
  assert.deepEqual(
    body.details.map(({ field }) => field),
    ['cenario', 'limite'],
  );
});

test('JSON malformado retorna erro 400 controlado', async (testContext) => {
  const baseUrl = await startTestServer(createApp(), testContext);
  const response = await fetch(`${baseUrl}/api/inexistente`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"incompleto":',
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, 'JSON inválido.');
});

test('payload JSON maior que 16 KB retorna erro 413 controlado', async (testContext) => {
  const baseUrl = await startTestServer(createApp(), testContext);
  const response = await fetch(`${baseUrl}/api/inexistente`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'x'.repeat(17 * 1024) }),
  });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.error, 'Payload JSON excede o limite de 16 KB.');
});

test('charset JSON não suportado retorna erro 415 controlado', async (testContext) => {
  const baseUrl = await startTestServer(createApp(), testContext);
  const response = await fetch(`${baseUrl}/api/inexistente`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=ascii' },
    body: '{}',
  });
  const body = await response.json();

  assert.equal(response.status, 415);
  assert.equal(body.error, 'Requisição inválida.');
});
