import fs from 'node:fs';
import path from 'node:path';

import express from 'express';

import { readDatabaseStatus } from './database/pool.js';

export function createApp({ databasePool = null, clientDistPath = null } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb', strict: true }));

  app.get('/api/health', async (_request, response, next) => {
    try {
      const database = await readDatabaseStatus(databasePool);
      const databaseUnavailable = database.status === 'unavailable';

      response.status(databaseUnavailable ? 503 : 200).json({
        status: databaseUnavailable ? 'degraded' : 'ok',
        service: 'shoot-n-smash-api',
        phase: 16,
        database,
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', (_request, response) => {
    response.status(404).json({
      error: 'Rota da API não encontrada.',
    });
  });

  if (clientDistPath && fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('/{*splat}', (_request, response) => {
      response.sendFile(path.join(clientDistPath, 'index.html'));
    });
  } else {
    app.get('/', (_request, response) => {
      response.json({
        name: "Shoot 'n' Smash API",
        health: '/api/health',
      });
    });
  }

  app.use((error, _request, response, _next) => {
    if (error?.type === 'entity.too.large' || error?.status === 413) {
      response.status(413).json({ error: 'Payload JSON excede o limite de 16 KB.' });
      return;
    }

    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({ error: 'JSON inválido.' });
      return;
    }

    const clientErrorStatus = Number(error?.status ?? error?.statusCode);
    if (
      Number.isInteger(clientErrorStatus) &&
      clientErrorStatus >= 400 &&
      clientErrorStatus < 500
    ) {
      response.status(clientErrorStatus).json({ error: 'Requisição inválida.' });
      return;
    }

    response.status(500).json({ error: 'Erro interno do servidor.' });
  });

  return app;
}
