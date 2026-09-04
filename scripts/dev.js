import path from 'node:path';

import { createServer as createViteServer } from 'vite';

import { createApp } from '../server/src/app.js';
import {
  loadEnvironmentFile,
  PROJECT_ROOT,
  readEnvironment,
} from '../server/src/config/env.js';
import { createDatabasePool } from '../server/src/database/pool.js';
import { createMatchRepository } from '../server/src/matches/createMatchRepository.js';
import { MatchService } from '../server/src/matches/MatchService.js';

loadEnvironmentFile();

const environment = readEnvironment();
const databasePool = createDatabasePool(environment.databaseUrl);
const matchService = new MatchService({
  repository: createMatchRepository(databasePool),
});
const app = createApp({ databasePool, matchService });
const apiServer = app.listen(environment.port, environment.host);

await new Promise((resolve, reject) => {
  apiServer.once('listening', resolve);
  apiServer.once('error', reject);
});

const viteServer = await createViteServer({
  root: path.join(PROJECT_ROOT, 'client'),
  configLoader: 'native',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://${environment.host}:${environment.port}`,
        changeOrigin: true,
      },
    },
  },
});

await viteServer.listen();

console.log(
  `Shoot 'n' Smash API disponível em http://${environment.host}:${environment.port}`,
);
viteServer.printUrls();

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Encerrando ambiente de desenvolvimento após ${signal}…`);

  await viteServer.close();
  await new Promise((resolve, reject) => {
    apiServer.close((error) => (error ? reject(error) : resolve()));
  });

  if (databasePool) {
    await databasePool.end();
  }
}

process.once('SIGINT', async () => {
  await shutdown('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', async () => {
  await shutdown('SIGTERM');
  process.exit(0);
});
