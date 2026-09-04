import {
  MatchValidationError,
  RankingQueryError,
} from './errors.js';

export const MATCH_LIMITS = Object.freeze({
  maxNameLength: 24,
  maxScore: 14_000,
  maxDurationMs: 24 * 60 * 60 * 1000,
  defaultRankingLimit: 10,
  maxRankingLimit: 100,
});

const MATCH_FIELDS = new Set([
  'submissionId',
  'nome',
  'pontuacao',
  'cenario',
  'resultado',
  'duracaoMs',
]);
const RESULT_VALUES = new Set(['victory', 'defeat']);
const SCENARIO_VALUES = new Set(['neve']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/u;

function issue(field, message) {
  return Object.freeze({ field, message });
}

function normalizeName(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
    : '';
}

function readSingleQueryValue(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('pt-BR') : null;
}

export function validateMatchPayload(payload) {
  const issues = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new MatchValidationError([
      issue('body', 'O corpo deve ser um objeto JSON.'),
    ]);
  }

  for (const field of Object.keys(payload)) {
    if (!MATCH_FIELDS.has(field)) {
      issues.push(issue(field, 'Campo não reconhecido.'));
    }
  }

  const submissionId = typeof payload.submissionId === 'string'
    ? payload.submissionId.trim().toLocaleLowerCase('en-US')
    : '';
  const playerName = normalizeName(payload.nome);
  const scenario = typeof payload.cenario === 'string'
    ? payload.cenario.trim().toLocaleLowerCase('pt-BR')
    : '';
  const result = typeof payload.resultado === 'string'
    ? payload.resultado.trim().toLocaleLowerCase('en-US')
    : '';

  if (!UUID_PATTERN.test(submissionId)) {
    issues.push(issue('submissionId', 'Informe um UUID válido.'));
  }

  if (playerName === '') {
    issues.push(issue('nome', 'Informe o nome do jogador.'));
  } else if (Array.from(playerName).length > MATCH_LIMITS.maxNameLength) {
    issues.push(
      issue('nome', `Use no máximo ${MATCH_LIMITS.maxNameLength} caracteres.`),
    );
  } else if (CONTROL_CHARACTER_PATTERN.test(playerName)) {
    issues.push(issue('nome', 'O nome contém caracteres de controle.'));
  }

  if (
    !Number.isInteger(payload.pontuacao) ||
    payload.pontuacao < 0 ||
    payload.pontuacao > MATCH_LIMITS.maxScore
  ) {
    issues.push(
      issue(
        'pontuacao',
        `Use um inteiro entre 0 e ${MATCH_LIMITS.maxScore}.`,
      ),
    );
  }

  if (!SCENARIO_VALUES.has(scenario)) {
    issues.push(issue('cenario', 'O único cenário aceito nesta fase é neve.'));
  }

  if (!RESULT_VALUES.has(result)) {
    issues.push(issue('resultado', 'Use victory ou defeat.'));
  }

  const durationMs = payload.duracaoMs ?? null;
  if (
    durationMs !== null &&
    (!Number.isInteger(durationMs) ||
      durationMs <= 0 ||
      durationMs > MATCH_LIMITS.maxDurationMs)
  ) {
    issues.push(
      issue(
        'duracaoMs',
        `Use um inteiro entre 1 e ${MATCH_LIMITS.maxDurationMs}.`,
      ),
    );
  }

  if (issues.length > 0) {
    throw new MatchValidationError(Object.freeze(issues));
  }

  return Object.freeze({
    submissionId,
    playerName,
    playerKey: playerName.toLocaleLowerCase('pt-BR'),
    score: payload.pontuacao,
    scenario,
    result,
    durationMs,
  });
}

export function validateRankingQuery(query = {}) {
  const issues = [];
  const unknownFields = Object.keys(query).filter(
    (field) => !['cenario', 'fase', 'limite'].includes(field),
  );

  for (const field of unknownFields) {
    issues.push(issue(field, 'Filtro não reconhecido.'));
  }

  const scenario = readSingleQueryValue(query.cenario);
  const phaseAlias = readSingleQueryValue(query.fase);

  if (query.cenario !== undefined && scenario === null) {
    issues.push(issue('cenario', 'Informe somente um cenário.'));
  }

  if (query.fase !== undefined && phaseAlias === null) {
    issues.push(issue('fase', 'Informe somente uma fase.'));
  }

  if (scenario && phaseAlias && scenario !== phaseAlias) {
    issues.push(issue('fase', 'fase e cenario não podem ser diferentes.'));
  }

  const selectedScenario = scenario || phaseAlias || null;
  if (selectedScenario && !SCENARIO_VALUES.has(selectedScenario)) {
    issues.push(issue('cenario', 'O único cenário aceito nesta fase é neve.'));
  }

  let limit = MATCH_LIMITS.defaultRankingLimit;
  if (query.limite !== undefined) {
    const rawLimit = typeof query.limite === 'string' ? query.limite.trim() : '';
    limit = /^\d+$/u.test(rawLimit) ? Number(rawLimit) : Number.NaN;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MATCH_LIMITS.maxRankingLimit
    ) {
      issues.push(
        issue(
          'limite',
          `Use um inteiro entre 1 e ${MATCH_LIMITS.maxRankingLimit}.`,
        ),
      );
    }
  }

  if (issues.length > 0) {
    throw new RankingQueryError(Object.freeze(issues));
  }

  return Object.freeze({ scenario: selectedScenario, limit });
}
