import { loadEnvironmentFile, readEnvironment } from '../config/env.js';
import { runMigrations } from './migration-runner.js';
import { createDatabasePool } from './pool.js';

loadEnvironmentFile();

const environment = readEnvironment();
if (!environment.databaseUrl) {
  throw new Error('DATABASE_URL deve ser configurada para executar migrations.');
}

const databasePool = createDatabasePool(environment.databaseUrl);

try {
  const result = await runMigrations({ pool: databasePool });
  const message = result.applied.length > 0
    ? `Migrations aplicadas: ${result.applied.join(', ')}.`
    : `Schema atualizado; ${result.total} migrations já estavam aplicadas.`;
  console.log(message);
} finally {
  await databasePool.end();
}
