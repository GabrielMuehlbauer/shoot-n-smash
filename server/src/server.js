import { createApp } from './app.js';
import { loadEnvironmentFile, readEnvironment } from './config/env.js';
import { createDatabasePool } from './database/pool.js';
import { createMatchRepository } from './matches/createMatchRepository.js';
import { MatchService } from './matches/MatchService.js';

loadEnvironmentFile();

const environment = readEnvironment();
const databasePool = createDatabasePool(environment.databaseUrl);
const matchService = new MatchService({
  repository: createMatchRepository(databasePool),
});
const app = createApp({
  databasePool,
  clientDistPath: environment.clientDistPath,
  matchService,
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
