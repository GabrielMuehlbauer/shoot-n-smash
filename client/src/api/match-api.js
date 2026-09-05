const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function freezeRankingEntry(entry) {
  if (
    !Number.isInteger(entry?.posicao) ||
    entry.posicao < 1 ||
    typeof entry.nome !== 'string' ||
    entry.nome.trim() === '' ||
    !Number.isInteger(entry.pontuacao) ||
    entry.pontuacao < 0 ||
    typeof entry.cenario !== 'string' ||
    entry.cenario.trim() === '' ||
    typeof entry.data !== 'string' ||
    Number.isNaN(Date.parse(entry.data))
  ) {
    throw new TypeError('A API retornou uma entrada de ranking inválida.');
  }

  return Object.freeze({
    posicao: entry.posicao,
    nome: entry.nome.trim(),
    pontuacao: entry.pontuacao,
    cenario: entry.cenario.trim(),
    data: entry.data,
  });
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new MatchApiError('A API retornou uma resposta inválida.', {
      status: response.status,
    });
  }
}

export class MatchApiError extends Error {
  constructor(message, { status = 0, code = null, details = null } = {}) {
    super(message);
    this.name = 'MatchApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createSubmissionId(cryptoRef = globalThis.crypto) {
  if (typeof cryptoRef?.randomUUID === 'function') {
    const id = cryptoRef.randomUUID();

    if (!UUID_PATTERN.test(id)) {
      throw new TypeError('O gerador retornou um UUID v4 inválido.');
    }

    return id.toLocaleLowerCase('en-US');
  }

  if (typeof cryptoRef?.getRandomValues !== 'function') {
    throw new Error('Este navegador não oferece geração segura de UUID.');
  }

  const bytes = cryptoRef.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

export function createMatchSubmission({
  submissionId,
  playerName,
  score,
  scenario,
  result,
  startedAt,
  completedAt,
} = {}) {
  if (!UUID_PATTERN.test(submissionId ?? '')) {
    throw new TypeError('A partida requer um UUID v4 válido.');
  }

  if (typeof playerName !== 'string' || playerName.trim() === '') {
    throw new TypeError('A partida requer o nome do jogador.');
  }

  if (!Number.isInteger(score) || score < 0) {
    throw new RangeError('A pontuação deve ser um inteiro não negativo.');
  }

  if (typeof scenario !== 'string' || scenario.trim() === '') {
    throw new TypeError('A partida requer um cenário.');
  }

  if (!['victory', 'defeat'].includes(result)) {
    throw new RangeError('O resultado deve ser victory ou defeat.');
  }

  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(completedAt) ||
    completedAt < startedAt
  ) {
    throw new RangeError('Os tempos da partida são inválidos.');
  }

  return Object.freeze({
    submissionId: submissionId.toLocaleLowerCase('en-US'),
    nome: playerName.trim(),
    pontuacao: score,
    cenario: scenario.trim().toLocaleLowerCase('pt-BR'),
    resultado: result,
    duracaoMs: Math.max(1, Math.round(completedAt - startedAt)),
  });
}

export function normalizeRankingPayload(payload) {
  if (
    !payload ||
    !Array.isArray(payload.ranking) ||
    !Number.isInteger(payload.total) ||
    payload.total < 0
  ) {
    throw new TypeError('A API retornou um ranking inválido.');
  }

  const ranking = Object.freeze(payload.ranking.map(freezeRankingEntry));

  if (payload.total < ranking.length) {
    throw new TypeError('O total do ranking não pode ser menor que a lista.');
  }

  return Object.freeze({ ranking, total: payload.total });
}

export function formatMatchDuration(durationMs) {
  const numericDuration = Number(durationMs);

  if (!Number.isFinite(numericDuration) || numericDuration < 0) {
    throw new RangeError('A duração da partida é inválida.');
  }

  const totalSeconds = Math.max(1, Math.round(numericDuration / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatRankingDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError('A data do ranking é inválida.');
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export class MatchApiClient {
  constructor({ fetchImpl = globalThis.fetch, basePath = '/api' } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('MatchApiClient requer uma função fetch.');
    }

    if (typeof basePath !== 'string' || basePath.trim() === '') {
      throw new TypeError('MatchApiClient requer um caminho base preenchido.');
    }

    this.fetchImpl = fetchImpl;
    this.basePath = basePath.replace(/\/$/u, '');
  }

  async submitMatch(match) {
    const response = await this.fetchImpl(`${this.basePath}/partidas`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(match),
    });
    const payload = await readJson(response);

    if (!response.ok) {
      throw new MatchApiError(
        payload?.error ?? 'Não foi possível registrar a partida.',
        {
          status: response.status,
          code: payload?.code ?? null,
          details: payload?.details ?? null,
        },
      );
    }

    if (!payload?.partida || typeof payload.duplicada !== 'boolean') {
      throw new MatchApiError('A API não confirmou o registro da partida.', {
        status: response.status,
      });
    }

    return Object.freeze({
      duplicate: payload.duplicada,
      match: Object.freeze({ ...payload.partida }),
    });
  }

  async getRanking({ scenario = 'neve', limit = 10 } = {}) {
    const query = new URLSearchParams({
      cenario: scenario,
      limite: String(limit),
    });
    const response = await this.fetchImpl(
      `${this.basePath}/ranking?${query.toString()}`,
      { headers: { Accept: 'application/json' } },
    );
    const payload = await readJson(response);

    if (!response.ok) {
      throw new MatchApiError(
        payload?.error ?? 'Não foi possível consultar o ranking.',
        {
          status: response.status,
          code: payload?.code ?? null,
          details: payload?.details ?? null,
        },
      );
    }

    return normalizeRankingPayload(payload);
  }
}
