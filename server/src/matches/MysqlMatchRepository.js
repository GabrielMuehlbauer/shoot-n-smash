const SELECT_MATCH_SQL = `
  SELECT
    m.id AS match_id,
    m.submission_id,
    m.score,
    m.scenario,
    m.result,
    m.duration_ms,
    m.completed_at,
    p.id AS player_id,
    p.name AS player_name,
    p.normalized_name AS player_key
  FROM matches AS m
  INNER JOIN players AS p ON p.id = m.player_id
`;

function requireDatabaseClient(client, method) {
  if (typeof client?.[method] !== 'function') {
    throw new TypeError(`O cliente MySQL requer ${method}().`);
  }
}

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError('O banco retornou completed_at inválido.');
  }

  return date.toISOString();
}

function mapMatchRow(row) {
  return Object.freeze({
    id: Number(row.match_id),
    submissionId: row.submission_id,
    player: Object.freeze({
      id: Number(row.player_id),
      name: row.player_name,
      key: row.player_key,
    }),
    score: Number(row.score),
    scenario: row.scenario,
    result: row.result,
    durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
    completedAt: toIsoString(row.completed_at),
  });
}

async function findBySubmissionId(client, submissionId) {
  const [rows] = await client.execute(
    `${SELECT_MATCH_SQL} WHERE m.submission_id = ? LIMIT 1`,
    [submissionId],
  );
  return rows.length === 0 ? null : mapMatchRow(rows[0]);
}

export class MysqlMatchRepository {
  constructor({ pool, configVersion = '0.25.0-beta.2' } = {}) {
    requireDatabaseClient(pool, 'execute');
    requireDatabaseClient(pool, 'getConnection');

    if (
      typeof configVersion !== 'string' ||
      configVersion.trim() === '' ||
      configVersion.length > 16
    ) {
      throw new TypeError('configVersion deve ter entre 1 e 16 caracteres.');
    }

    this.pool = pool;
    this.configVersion = configVersion;
  }

  async findBySubmissionId(submissionId) {
    return findBySubmissionId(this.pool, submissionId);
  }

  async create(matchData) {
    const connection = await this.pool.getConnection();
    let transactionStarted = false;

    try {
      await connection.beginTransaction();
      transactionStarted = true;

      const [playerResult] = await connection.execute(
        `INSERT INTO players (name, normalized_name, created_at)
         VALUES (?, ?, UTC_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [matchData.playerName, matchData.playerKey],
      );
      const playerId = Number(playerResult.insertId);

      const [matchResult] = await connection.execute(
        `INSERT INTO matches (
           submission_id,
           player_id,
           score,
           scenario,
           result,
           duration_ms,
           config_version,
           completed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
        [
          matchData.submissionId,
          playerId,
          matchData.score,
          matchData.scenario,
          matchData.result,
          matchData.durationMs,
          this.configVersion,
        ],
      );

      const match = await findBySubmissionId(
        connection,
        matchData.submissionId,
      );

      if (!match || match.id !== Number(matchResult.insertId)) {
        throw new Error('A partida criada não pôde ser confirmada.');
      }

      await connection.commit();
      transactionStarted = false;

      return Object.freeze({ created: true, match });
    } catch (error) {
      if (transactionStarted) {
        try {
          await connection.rollback();
        } catch {
          // O erro original continua sendo a causa relevante para a API.
        }
      }

      if (error?.code === 'ER_DUP_ENTRY') {
        const existing = await findBySubmissionId(
          connection,
          matchData.submissionId,
        );

        if (existing) {
          return Object.freeze({ created: false, match: existing });
        }
      }

      throw error;
    } finally {
      connection.release();
    }
  }

  async list({ scenario = null } = {}) {
    const where = scenario === null ? '' : ' WHERE m.scenario = ?';
    const parameters = scenario === null ? [] : [scenario];
    const [rows] = await this.pool.execute(
      `${SELECT_MATCH_SQL}${where} ORDER BY m.score DESC, m.completed_at ASC`,
      parameters,
    );

    return rows.map(mapMatchRow);
  }
}
