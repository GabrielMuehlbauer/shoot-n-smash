export class ApiError extends Error {
  constructor(message, { code, details = undefined, status = 400 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export class MatchValidationError extends ApiError {
  constructor(details) {
    super('Os dados da partida são inválidos.', {
      code: 'INVALID_MATCH',
      details,
      status: 400,
    });
    this.name = 'MatchValidationError';
  }
}

export class RankingQueryError extends ApiError {
  constructor(details) {
    super('Os filtros do ranking são inválidos.', {
      code: 'INVALID_RANKING_FILTER',
      details,
      status: 400,
    });
    this.name = 'RankingQueryError';
  }
}

export class SubmissionConflictError extends ApiError {
  constructor() {
    super('O submissionId já pertence a outra partida.', {
      code: 'SUBMISSION_CONFLICT',
      status: 409,
    });
    this.name = 'SubmissionConflictError';
  }
}
