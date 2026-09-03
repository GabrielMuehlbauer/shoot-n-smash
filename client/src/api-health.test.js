import assert from 'node:assert/strict';
import test from 'node:test';

import { describeApiHealth } from './api-health.js';

test('descreve API online sem MySQL configurado', () => {
  assert.deepEqual(
    describeApiHealth(200, {
      status: 'ok',
      phase: 13,
      database: { status: 'not-configured' },
    }),
    {
      state: 'success',
      message: 'API online. Fase 13. MySQL ainda não configurado, como esperado nesta etapa.',
    },
  );
});

test('distingue API online de MySQL indisponível', () => {
  assert.deepEqual(
    describeApiHealth(503, {
      status: 'degraded',
      phase: 13,
      database: { status: 'unavailable' },
    }),
    {
      state: 'warning',
      message: 'API online. Fase 13. O MySQL está indisponível. Verifique a configuração do banco.',
    },
  );
});

test('não classifica uma resposta desconhecida como saudável', () => {
  assert.equal(describeApiHealth(500, { status: 'error' }), null);
});
