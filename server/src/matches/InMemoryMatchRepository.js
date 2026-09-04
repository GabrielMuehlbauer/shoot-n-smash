function requireFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`${name} deve ser uma função.`);
  }
}

export class InMemoryMatchRepository {
  constructor({ clock = () => new Date() } = {}) {
    requireFunction(clock, 'clock');
    this.clock = clock;
    this.matches = [];
    this.matchesBySubmissionId = new Map();
    this.playersByKey = new Map();
    this.nextMatchId = 1;
    this.nextPlayerId = 1;
  }

  async findBySubmissionId(submissionId) {
    return this.matchesBySubmissionId.get(submissionId) ?? null;
  }

  async create(matchData) {
    const existing = this.matchesBySubmissionId.get(matchData.submissionId);
    if (existing) {
      return Object.freeze({ created: false, match: existing });
    }

    let player = this.playersByKey.get(matchData.playerKey);
    if (!player) {
      player = Object.freeze({
        id: this.nextPlayerId++,
        name: matchData.playerName,
        key: matchData.playerKey,
      });
      this.playersByKey.set(matchData.playerKey, player);
    }

    const completedAt = this.clock();
    if (!(completedAt instanceof Date) || Number.isNaN(completedAt.getTime())) {
      throw new TypeError('clock deve retornar uma data válida.');
    }

    const match = Object.freeze({
      id: this.nextMatchId++,
      submissionId: matchData.submissionId,
      player,
      score: matchData.score,
      scenario: matchData.scenario,
      result: matchData.result,
      durationMs: matchData.durationMs,
      completedAt: completedAt.toISOString(),
    });

    this.matches.push(match);
    this.matchesBySubmissionId.set(match.submissionId, match);
    return Object.freeze({ created: true, match });
  }

  async list({ scenario = null } = {}) {
    return this.matches.filter(
      (match) => scenario === null || match.scenario === scenario,
    );
  }
}
