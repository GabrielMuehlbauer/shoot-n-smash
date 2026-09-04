import { InMemoryMatchRepository } from './InMemoryMatchRepository.js';
import { SubmissionConflictError } from './errors.js';
import {
  validateMatchPayload,
  validateRankingQuery,
} from './match-validation.js';

function representsSameSubmission(match, data) {
  return (
    match.player.key === data.playerKey &&
    match.score === data.score &&
    match.scenario === data.scenario &&
    match.result === data.result &&
    match.durationMs === data.durationMs
  );
}

function publicMatch(match) {
  return Object.freeze({
    id: match.id,
    submissionId: match.submissionId,
    jogador: Object.freeze({
      id: match.player.id,
      nome: match.player.name,
    }),
    pontuacao: match.score,
    cenario: match.scenario,
    resultado: match.result,
    duracaoMs: match.durationMs,
    data: match.completedAt,
  });
}

function chooseBestMatch(bestByPlayer, match) {
  const current = bestByPlayer.get(match.player.id);

  if (
    !current ||
    match.score > current.score ||
    (match.score === current.score && match.completedAt < current.completedAt)
  ) {
    bestByPlayer.set(match.player.id, match);
  }
}

export class MatchService {
  constructor({ repository = new InMemoryMatchRepository() } = {}) {
    for (const method of ['findBySubmissionId', 'create', 'list']) {
      if (typeof repository?.[method] !== 'function') {
        throw new TypeError(`O repositório de partidas requer ${method}().`);
      }
    }

    this.repository = repository;
  }

  async submit(payload) {
    const data = validateMatchPayload(payload);
    const existing = await this.repository.findBySubmissionId(data.submissionId);

    if (existing) {
      if (!representsSameSubmission(existing, data)) {
        throw new SubmissionConflictError();
      }

      return Object.freeze({ created: false, match: publicMatch(existing) });
    }

    const stored = await this.repository.create(data);
    if (!stored.created && !representsSameSubmission(stored.match, data)) {
      throw new SubmissionConflictError();
    }

    return Object.freeze({
      created: stored.created,
      match: publicMatch(stored.match),
    });
  }

  async ranking(query) {
    const filters = validateRankingQuery(query);
    const matches = await this.repository.list({ scenario: filters.scenario });
    const bestByPlayer = new Map();

    for (const match of matches) {
      chooseBestMatch(bestByPlayer, match);
    }

    const ordered = [...bestByPlayer.values()].sort(
      (left, right) =>
        right.score - left.score ||
        left.completedAt.localeCompare(right.completedAt) ||
        left.player.name.localeCompare(right.player.name, 'pt-BR'),
    );

    let previousScore = null;
    let previousPosition = 0;
    const ranking = ordered.slice(0, filters.limit).map((match, index) => {
      const position = match.score === previousScore
        ? previousPosition
        : index + 1;
      previousScore = match.score;
      previousPosition = position;

      return Object.freeze({
        posicao: position,
        nome: match.player.name,
        pontuacao: match.score,
        cenario: match.scenario,
        data: match.completedAt,
      });
    });

    return Object.freeze({
      ranking: Object.freeze(ranking),
      total: ordered.length,
      filtros: Object.freeze({
        cenario: filters.scenario,
        limite: filters.limit,
      }),
    });
  }
}
