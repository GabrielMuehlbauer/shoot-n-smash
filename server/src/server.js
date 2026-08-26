import { createApp } from './app.js';
import { loadEnvironmentFile, readEnvironment } from './config/env.js';
import { createDatabasePool } from './database/pool.js';

loadEnvironmentFile();

const environment = readEnvironment();
const databasePool = createDatabasePool(environment.databaseUrl);
const app = createApp({
  databasePool,
  clientDistPath: environment.clientDistPath,
});

const server = app.listen(environment.port, environment.host, () => {
  console.log(
    `Shoot 'n' Smash API disponível em http://${environment.host}:${environment.port}`,
  );
});

async function shutdown(signal) {
  console.log(`Encerrando servidor após ${signal}…`);

  server.close(async () => {
    if (databasePool) {
      await databasePool.end();
    }

    process.exit(0);
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
