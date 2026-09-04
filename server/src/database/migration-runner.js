import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DEFAULT_MIGRATIONS_PATH = fileURLToPath(
  new URL('./migrations/', import.meta.url),
);
const MIGRATION_LOCK_NAME = 'shoot_n_smash_schema_migrations';
const MIGRATION_FILE_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/u;

const CREATE_MIGRATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    applied_at DATETIME(3) NOT NULL,
    PRIMARY KEY (version)
  ) ENGINE = InnoDB
    DEFAULT CHARACTER SET = utf8mb4
    COLLATE = utf8mb4_unicode_ci
`;

function checksum(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function readMigrations({
  migrationsPath = DEFAULT_MIGRATIONS_PATH,
} = {}) {
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));

  if (files.length === 0) {
    throw new Error('Nenhuma migration SQL foi encontrada.');
  }

  return Promise.all(
    files.map(async (version) => {
      const sql = (await readFile(`${migrationsPath}/${version}`, 'utf8')).trim();

      if (sql === '') {
        throw new Error(`A migration ${version} está vazia.`);
      }

      return Object.freeze({ version, sql, checksum: checksum(sql) });
    }),
  );
}

export async function runMigrations({
  pool,
  migrationsPath = DEFAULT_MIGRATIONS_PATH,
  lockTimeoutSeconds = 10,
} = {}) {
  if (typeof pool?.getConnection !== 'function') {
    throw new TypeError('O executor de migrations requer um pool MySQL.');
  }

  if (!Number.isInteger(lockTimeoutSeconds) || lockTimeoutSeconds < 0) {
    throw new RangeError('lockTimeoutSeconds deve ser um inteiro não negativo.');
  }

  const migrations = await readMigrations({ migrationsPath });
  const connection = await pool.getConnection();
  let lockAcquired = false;

  try {
    await connection.query(CREATE_MIGRATIONS_TABLE_SQL);
    const [lockRows] = await connection.execute(
      'SELECT GET_LOCK(?, ?) AS acquired',
      [MIGRATION_LOCK_NAME, lockTimeoutSeconds],
    );
    lockAcquired = Number(lockRows[0]?.acquired) === 1;

    if (!lockAcquired) {
      throw new Error('Não foi possível obter a trava das migrations.');
    }

    const [appliedRows] = await connection.query(
      'SELECT version, checksum FROM schema_migrations ORDER BY version',
    );
    const applied = new Map(
      appliedRows.map((row) => [row.version, row.checksum]),
    );
    const newlyApplied = [];

    for (const migration of migrations) {
      const previousChecksum = applied.get(migration.version);

      if (previousChecksum !== undefined) {
        if (previousChecksum !== migration.checksum) {
          throw new Error(
            `A migration aplicada ${migration.version} foi modificada.`,
          );
        }

        continue;
      }

      await connection.query(migration.sql);
      await connection.execute(
        `INSERT INTO schema_migrations (version, checksum, applied_at)
         VALUES (?, ?, UTC_TIMESTAMP(3))`,
        [migration.version, migration.checksum],
      );
      newlyApplied.push(migration.version);
    }

    return Object.freeze({
      applied: Object.freeze(newlyApplied),
      total: migrations.length,
    });
  } finally {
    if (lockAcquired) {
      try {
        await connection.execute('SELECT RELEASE_LOCK(?)', [MIGRATION_LOCK_NAME]);
      } catch {
        // A conexão será liberada mesmo se o servidor já tiver descartado a trava.
      }
    }

    connection.release();
  }
}
