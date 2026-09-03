import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';

function validatePoints(name, points) {
  if (!Number.isInteger(points) || points < 0) {
    throw new RangeError(`${name} deve ser um inteiro não negativo.`);
  }
}

function validateConfig(config) {
  if (
    !config?.enemyElimination ||
    typeof config.enemyElimination !== 'object' ||
    Array.isArray(config.enemyElimination)
  ) {
    throw new TypeError('score.enemyElimination deve ser um objeto.');
  }

  const entries = Object.entries(config.enemyElimination);

  if (entries.length === 0) {
    throw new RangeError('score.enemyElimination não pode estar vazio.');
  }

  for (const [typeId, points] of entries) {
    if (typeId.trim() === '') {
      throw new TypeError('score.enemyElimination requer IDs não vazios.');
    }

    validatePoints(`score.enemyElimination.${typeId}`, points);
  }

  validatePoints('score.waveCompleted', config.waveCompleted);
  validatePoints('score.phaseCompleted', config.phaseCompleted);
}

function validateEventId(eventId) {
  if (typeof eventId !== 'string' || eventId.trim() === '') {
    throw new TypeError('ScoreManager requer eventId não vazio.');
  }

  return eventId;
}

export class ScoreManager {
  constructor({
    config = GAMEPLAY_CONFIG.score,
    onScoreChange = () => {},
  } = {}) {
    validateConfig(config);

    if (typeof onScoreChange !== 'function') {
      throw new TypeError('ScoreManager requer onScoreChange como função.');
    }

    this.config = Object.freeze({
      enemyElimination: Object.freeze({ ...config.enemyElimination }),
      waveCompleted: config.waveCompleted,
      phaseCompleted: config.phaseCompleted,
    });
    this.onScoreChange = onScoreChange;
    this.currentScore = 0;
    this.processedEventIds = new Set();
    this.lastEvent = null;
    this.disposed = false;
  }

  get score() {
    return this.currentScore;
  }

  get state() {
    return Object.freeze({
      score: this.currentScore,
      eventCount: this.processedEventIds.size,
      lastEvent: this.lastEvent,
    });
  }

  recordEnemyEliminated({ eventId, typeId } = {}) {
    this.assertNotDisposed();

    if (
      typeof typeId !== 'string' ||
      !Object.hasOwn(this.config.enemyElimination, typeId)
    ) {
      throw new RangeError('ScoreManager recebeu um tipo de inimigo desconhecido.');
    }

    return this.record({
      eventId,
      type: `enemy-eliminated:${typeId}`,
      points: this.config.enemyElimination[typeId],
    });
  }

  recordWaveCompleted({ eventId } = {}) {
    return this.record({
      eventId,
      type: 'wave-completed',
      points: this.config.waveCompleted,
    });
  }

  recordPhaseCompleted({ eventId } = {}) {
    return this.record({
      eventId,
      type: 'phase-completed',
      points: this.config.phaseCompleted,
    });
  }

  record({ eventId, type, points }) {
    this.assertNotDisposed();
    const validEventId = validateEventId(eventId);

    if (typeof type !== 'string' || type.trim() === '') {
      throw new TypeError('ScoreManager requer um tipo de evento não vazio.');
    }

    validatePoints('ScoreManager.points', points);

    if (this.processedEventIds.has(validEventId)) {
      return false;
    }

    this.processedEventIds.add(validEventId);
    this.currentScore += points;
    this.lastEvent = Object.freeze({
      id: validEventId,
      type,
      points,
    });
    const change = Object.freeze({
      ...this.state,
      awardedPoints: points,
    });

    this.onScoreChange(change);
    return change;
  }

  reset() {
    if (this.disposed) {
      return false;
    }

    this.currentScore = 0;
    this.processedEventIds.clear();
    this.lastEvent = null;
    return true;
  }

  assertNotDisposed() {
    if (this.disposed) {
      throw new Error('O gerenciador de pontuação foi descartado.');
    }
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.onScoreChange = () => {};
    this.disposed = true;
    return true;
  }
}
