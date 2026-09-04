import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  readMigrations,
  runMigrations,
} from '../src/database/migration-runner.js';

async function createMigrationDirectory(testContext) {
  const directory = await mkdtemp(path.join(tmpdir(), 'shoot-n-smash-migrations-'));
  testContext.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    path.join(directory, '002_second.sql'),
    'CREATE TABLE second_table (id INT)',
    'utf8',
  );
  await writeFile(
    path.join(directory, '001_first.sql'),
    'CREATE TABLE first_table (id INT)',
    'utf8',
  );
  await writeFile(path.join(directory, 'README.txt'), 'ignorado', 'utf8');
  return directory;
}

function createMigrationPool({ appliedRows = [], lockValue = 1 } = {}) {
  const events = [];
  const connection = {
    async query(sql) {
      events.push({ kind: 'query', sql });
      if (sql.includes('SELECT version, checksum')) {
        return [appliedRows];
      }
      return [[]];
    },
    async execute(sql, parameters) {
      events.push({ kind: 'execute', sql, parameters });
      if (sql.includes('GET_LOCK')) {
        return [[{ acquired: lockValue }]];
      }
      return [[]];
    },
    release() {
      events.push({ kind: 'release' });
    },
  };

  return {
    events,
    pool: {
      async getConnection() {
        return connection;
      },
    },
  };
}

test('lê somente migrations válidas em ordem e calcula checksum', async (testContext) => {
  const migrationsPath = await createMigrationDirectory(testContext);
  const migrations = await readMigrations({ migrationsPath });

  assert.deepEqual(
    migrations.map(({ version }) => version),
    ['001_first.sql', '002_second.sql'],
  );
  assert.match(migrations[0].checksum, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(migrations[0]));
});

test('aplica migrations pendentes sob trava e registra checksums', async (testContext) => {
  const migrationsPath = await createMigrationDirectory(testContext);
  const { events, pool } = createMigrationPool();
  const result = await runMigrations({ pool, migrationsPath });

  assert.deepEqual(result, {
    applied: ['001_first.sql', '002_second.sql'],
    total: 2,
  });
  assert.equal(
    events.filter(({ sql }) => sql?.includes('CREATE TABLE first_table')).length,
    1,
  );
  assert.equal(
    events.filter(({ sql }) => sql?.includes('INSERT INTO schema_migrations')).length,
    2,
  );
  assert.match(events[1].sql, /GET_LOCK/);
  assert.match(events.at(-2).sql, /RELEASE_LOCK/);
  assert.equal(events.at(-1).kind, 'release');
});

test('ignora migration aplicada e rejeita checksum modificado', async (testContext) => {
  const migrationsPath = await createMigrationDirectory(testContext);
  const migrations = await readMigrations({ migrationsPath });
  const { events, pool } = createMigrationPool({
    appliedRows: [
      { version: migrations[0].version, checksum: migrations[0].checksum },
    ],
  });
  const result = await runMigrations({ pool, migrationsPath });

  assert.deepEqual(result.applied, ['002_second.sql']);
  assert.equal(
    events.some(({ sql }) => sql?.includes('CREATE TABLE first_table')),
    false,
  );

  const changed = createMigrationPool({
    appliedRows: [{ version: migrations[0].version, checksum: '0'.repeat(64) }],
  });
  await assert.rejects(
    runMigrations({ pool: changed.pool, migrationsPath }),
    /foi modificada/,
  );
  assert.equal(changed.events.at(-1).kind, 'release');
});

test('falha sem trava e sempre libera a conexão', async (testContext) => {
  const migrationsPath = await createMigrationDirectory(testContext);
  const { events, pool } = createMigrationPool({ lockValue: 0 });

  await assert.rejects(
    runMigrations({ pool, migrationsPath, lockTimeoutSeconds: 0 }),
    /trava/,
  );
  assert.equal(events.at(-1).kind, 'release');
  assert.equal(events.some(({ sql }) => sql?.includes('RELEASE_LOCK')), false);
  await assert.rejects(
    runMigrations({ pool: null, migrationsPath }),
    /pool MySQL/,
  );
  await assert.rejects(
    runMigrations({ pool, migrationsPath, lockTimeoutSeconds: -1 }),
    /lockTimeoutSeconds/,
  );
});
