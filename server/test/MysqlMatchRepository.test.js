import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryMatchRepository } from '../src/matches/InMemoryMatchRepository.js';
import { MysqlMatchRepository } from '../src/matches/MysqlMatchRepository.js';
import { createMatchRepository } from '../src/matches/createMatchRepository.js';

const MATCH_DATA = Object.freeze({
  submissionId: '00000000-0000-4000-8000-000000000001',
  playerName: 'Jogador',
  playerKey: 'jogador',
  score: 6800,
  scenario: 'neve',
  result: 'victory',
  durationMs: 120_000,
});

function createRow(overrides = {}) {
  return {
    match_id: 11,
    submission_id: MATCH_DATA.submissionId,
    score: MATCH_DATA.score,
    scenario: MATCH_DATA.scenario,
    result: MATCH_DATA.result,
    duration_ms: MATCH_DATA.durationMs,
    completed_at: new Date('2026-09-04T12:00:00.000Z'),
    player_id: 7,
    player_name: MATCH_DATA.playerName,
    player_key: MATCH_DATA.playerKey,
    ...overrides,
  };
}

test('consulta por submissionId com placeholder e converte a linha', async () => {
  const calls = [];
  const pool = {
    getConnection() {},
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[createRow()]];
    },
  };
  const repository = new MysqlMatchRepository({ pool });
  const match = await repository.findBySubmissionId(MATCH_DATA.submissionId);

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /m\.submission_id = \?/);
  assert.deepEqual(calls[0].parameters, [MATCH_DATA.submissionId]);
  assert.deepEqual(match, {
    id: 11,
    submissionId: MATCH_DATA.submissionId,
    player: { id: 7, name: 'Jogador', key: 'jogador' },
    score: 6800,
    scenario: 'neve',
    result: 'victory',
    durationMs: 120_000,
    completedAt: '2026-09-04T12:00:00.000Z',
  });
});

test('cria jogador e partida em uma transação parametrizada', async () => {
  const events = [];
  const connection = {
    async beginTransaction() {
      events.push('begin');
    },
    async execute(sql, parameters) {
      events.push({ sql, parameters });

      if (sql.includes('INSERT INTO players')) {
        return [{ insertId: 7 }];
      }

      if (sql.includes('INSERT INTO matches')) {
        return [{ insertId: 11 }];
      }

      return [[createRow()]];
    },
    async commit() {
      events.push('commit');
    },
    async rollback() {
      events.push('rollback');
    },
    release() {
      events.push('release');
    },
  };
  const pool = {
    execute() {},
    async getConnection() {
      return connection;
    },
  };
  const repository = new MysqlMatchRepository({ pool });
  const result = await repository.create(MATCH_DATA);

  assert.equal(result.created, true);
  assert.equal(result.match.id, 11);
  assert.deepEqual(events.filter((event) => typeof event === 'string'), [
    'begin',
    'commit',
    'release',
  ]);

  const playerInsert = events.find(
    (event) => event.sql?.includes('INSERT INTO players'),
  );
  assert.match(playerInsert.sql, /ON DUPLICATE KEY UPDATE/);
  assert.deepEqual(playerInsert.parameters, ['Jogador', 'jogador']);

  const matchInsert = events.find(
    (event) => event.sql?.includes('INSERT INTO matches'),
  );
  assert.deepEqual(matchInsert.parameters, [
    MATCH_DATA.submissionId,
    7,
    6800,
    'neve',
    'victory',
    120_000,
    '0.25.0-beta.2',
  ]);
});

test('faz rollback e recupera a partida numa corrida de submissionId', async () => {
  const events = [];
  const duplicateError = Object.assign(new Error('duplicate'), {
    code: 'ER_DUP_ENTRY',
  });
  const connection = {
    async beginTransaction() {
      events.push('begin');
    },
    async execute(sql) {
      if (sql.includes('INSERT INTO players')) {
        return [{ insertId: 7 }];
      }

      if (sql.includes('INSERT INTO matches')) {
        throw duplicateError;
      }

      return [[createRow()]];
    },
    async commit() {
      events.push('commit');
    },
    async rollback() {
      events.push('rollback');
    },
    release() {
      events.push('release');
    },
  };
  const repository = new MysqlMatchRepository({
    pool: {
      execute() {},
      async getConnection() {
        return connection;
      },
    },
  });
  const result = await repository.create(MATCH_DATA);

  assert.equal(result.created, false);
  assert.equal(result.match.id, 11);
  assert.deepEqual(events, ['begin', 'rollback', 'release']);
});

test('lista com filtro parametrizado e libera conexão após erro', async () => {
  const listCalls = [];
  const pool = {
    getConnection() {},
    async execute(sql, parameters) {
      listCalls.push({ sql, parameters });
      return [[createRow({ duration_ms: null })]];
    },
  };
  const repository = new MysqlMatchRepository({ pool });
  const matches = await repository.list({ scenario: 'neve' });

  assert.match(listCalls[0].sql, /m\.scenario = \?/);
  assert.deepEqual(listCalls[0].parameters, ['neve']);
  assert.equal(matches[0].durationMs, null);

  const events = [];
  const failingRepository = new MysqlMatchRepository({
    pool: {
      execute() {},
      async getConnection() {
        return {
          async beginTransaction() {
            events.push('begin');
          },
          async execute() {
            throw new Error('database failure');
          },
          async rollback() {
            events.push('rollback');
          },
          release() {
            events.push('release');
          },
        };
      },
    },
  });

  await assert.rejects(failingRepository.create(MATCH_DATA), /database failure/);
  assert.deepEqual(events, ['begin', 'rollback', 'release']);
});

test('seleciona MySQL somente quando existe pool e valida dependências', () => {
  assert.ok(createMatchRepository(null) instanceof InMemoryMatchRepository);

  const pool = { execute() {}, getConnection() {} };
  assert.ok(createMatchRepository(pool) instanceof MysqlMatchRepository);
  assert.throws(() => new MysqlMatchRepository(), /execute/);
  assert.throws(
    () => new MysqlMatchRepository({ pool, configVersion: '' }),
    /configVersion/,
  );
});
