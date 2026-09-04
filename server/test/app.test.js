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

test('GET /api/health funciona sem MySQL configurado', async (testContext) => {
  const baseUrl = await startTestServer(createApp(), testContext);
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.phase, 17);
  assert.equal(body.database.status, 'not-configured');
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
  assert.equal(body.phase, 17);
  assert.equal(body.database.status, 'unavailable');
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
