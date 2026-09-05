import fs from 'node:fs';
import path from 'node:path';

import express from 'express';

import { readDatabaseStatus } from './database/pool.js';
import { ApiError } from './matches/errors.js';
import { MatchService } from './matches/MatchService.js';
import { createMatchesRouter } from './routes/matches.js';

export function createApp({
  databasePool = null,
  clientDistPath = null,
  matchService = new MatchService(),
} = {}) {
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
        phase: 21,
        database,
        storage: {
          matches: databasePool ? 'mysql' : 'memory',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', createMatchesRouter({ matchService }));

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

    if (error instanceof ApiError) {
      const body = {
        error: error.message,
        code: error.code,
      };

      if (error.details !== undefined) {
        body.details = error.details;
      }

      response.status(error.status).json(body);
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
