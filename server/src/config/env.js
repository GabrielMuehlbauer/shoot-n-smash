import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

export const PROJECT_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export function loadEnvironmentFile() {
  dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });
}

export function readEnvironment(source = process.env) {
  const rawPort = String(source.PORT ?? '3000').trim();
  const port = Number(rawPort);

  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT deve ser um número inteiro entre 1 e 65535.');
  }

  return Object.freeze({
    nodeEnv: source.NODE_ENV?.trim() || 'development',
    host: source.HOST?.trim() || '127.0.0.1',
    port,
    databaseUrl: source.DATABASE_URL?.trim() || null,
    clientDistPath: path.join(PROJECT_ROOT, 'client', 'dist'),
  });
}
