import mysql from 'mysql2/promise';

export function createDatabasePool(databaseUrl) {
  if (!databaseUrl) {
    return null;
  }

  return mysql.createPool({
    uri: databaseUrl,
    charset: 'utf8mb4',
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

export async function readDatabaseStatus(databasePool) {
  if (!databasePool) {
    return { status: 'not-configured' };
  }

  try {
    await databasePool.query('SELECT 1 AS connection_test');
    return { status: 'connected' };
  } catch {
    return { status: 'unavailable' };
  }
}
