import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryMatchRepository } from '../src/matches/InMemoryMatchRepository.js';
import { MatchService } from '../src/matches/MatchService.js';

function createPayload(index, overrides = {}) {
  return {
    submissionId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    nome: `Jogador ${index}`,
    pontuacao: index * 100,
    cenario: 'neve',
    resultado: 'defeat',
    ...overrides,
  };
}

function createService() {
  let timestamp = Date.parse('2026-09-04T12:00:00.000Z');
  const repository = new InMemoryMatchRepository({
    clock: () => new Date((timestamp += 1000)),
  });
  return new MatchService({ repository });
}

test('registra jogador e partida com data gerada no servidor', async () => {
  const service = createService();
  const result = await service.submit(
    createPayload(1, { nome: '  Ana   Neve ', duracaoMs: 12_000 }),
  );

  assert.equal(result.created, true);
  assert.deepEqual(result.match, {
    id: 1,
    submissionId: '00000000-0000-4000-8000-000000000001',
    jogador: { id: 1, nome: 'Ana Neve' },
    pontuacao: 100,
    cenario: 'neve',
    resultado: 'defeat',
    duracaoMs: 12_000,
    data: '2026-09-04T12:00:01.000Z',
  });
});

test('torna o envio idempotente e detecta reutilização conflitante', async () => {
  const service = createService();
  const payload = createPayload(2, { nome: 'Bia' });
  const first = await service.submit(payload);
  const duplicate = await service.submit({ ...payload, nome: '  BIA ' });

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.match.id, first.match.id);

  await assert.rejects(
    service.submit({ ...payload, pontuacao: payload.pontuacao + 100 }),
    (error) => error.status === 409 && error.code === 'SUBMISSION_CONFLICT',
  );
});

test('ranking usa o melhor resultado por jogador e ordena pontuação decrescente', async () => {
  const service = createService();

  await service.submit(createPayload(1, { nome: 'Ana', pontuacao: 500 }));
  await service.submit(createPayload(2, { nome: 'Beto', pontuacao: 900 }));
  await service.submit(createPayload(3, { nome: 'ana', pontuacao: 1200 }));
  await service.submit(createPayload(4, { nome: 'Caio', pontuacao: 900 }));

  const result = await service.ranking({ cenario: 'neve', limite: '2' });

  assert.equal(result.total, 3);
  assert.deepEqual(result.filtros, { cenario: 'neve', limite: 2 });
  assert.deepEqual(result.ranking, [
    {
      posicao: 1,
      nome: 'Ana',
      pontuacao: 1200,
      cenario: 'neve',
      data: '2026-09-04T12:00:03.000Z',
    },
    {
      posicao: 2,
      nome: 'Beto',
      pontuacao: 900,
      cenario: 'neve',
      data: '2026-09-04T12:00:02.000Z',
    },
  ]);

  const complete = await service.ranking({ fase: 'neve' });
  assert.deepEqual(
    complete.ranking.map(({ posicao, pontuacao }) => ({ posicao, pontuacao })),
    [
      { posicao: 1, pontuacao: 1200 },
      { posicao: 2, pontuacao: 900 },
      { posicao: 2, pontuacao: 900 },
    ],
  );
});

test('valida o contrato do repositório e datas produzidas pelo relógio', async () => {
  assert.throws(() => new MatchService({ repository: {} }), /repositório/);
  assert.throws(
    () => new InMemoryMatchRepository({ clock: 'agora' }),
    /clock/,
  );

  const service = new MatchService({
    repository: new InMemoryMatchRepository({ clock: () => new Date('inválida') }),
  });
  await assert.rejects(service.submit(createPayload(5)), /data válida/);
});
