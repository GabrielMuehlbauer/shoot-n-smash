import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';

export function validateWaveConfig(config) {
  if (
    !Number.isFinite(config?.interWaveDelaySeconds) ||
    config.interWaveDelaySeconds < 0
  ) {
    throw new RangeError(
      'waves.interWaveDelaySeconds deve ser um número não negativo.',
    );
  }

  if (!Array.isArray(config.definitions) || config.definitions.length !== 4) {
    throw new RangeError('waves.definitions deve conter exatamente quatro ondas.');
  }

  for (const [index, wave] of config.definitions.entries()) {
    const expectedNumber = index + 1;

    if (wave?.number !== expectedNumber) {
      throw new RangeError(`A onda ${expectedNumber} deve usar number ${expectedNumber}.`);
    }

    if (!Number.isInteger(wave.enemyCount) || wave.enemyCount <= 0) {
      throw new RangeError(`waves.definitions[${index}].enemyCount deve ser positivo.`);
    }

    if (
      !Number.isFinite(wave.spawnIntervalSeconds) ||
      wave.spawnIntervalSeconds < 0
    ) {
      throw new RangeError(
        `waves.definitions[${index}].spawnIntervalSeconds não pode ser negativo.`,
      );
    }

    if (!Number.isFinite(wave.moveSpeed) || wave.moveSpeed <= 0) {
      throw new RangeError(`waves.definitions[${index}].moveSpeed deve ser positivo.`);
    }

    if (
      !Array.isArray(wave.typeIds) ||
      wave.typeIds.length === 0 ||
      wave.typeIds.some((id) => typeof id !== 'string' || id.length === 0) ||
      new Set(wave.typeIds).size !== wave.typeIds.length
    ) {
      throw new TypeError(
        `waves.definitions[${index}].typeIds deve conter IDs únicos.`,
      );
    }
  }

  return true;
}

export class WaveManager {
  constructor({ config = GAMEPLAY_CONFIG.waves } = {}) {
    validateWaveConfig(config);
    this.config = config;
    this.waveIndex = 0;
    this.enemyNumber = 1;
    this.status = 'active';
    this.remainingDelaySeconds = 0;
  }

  get currentWave() {
    return this.config.definitions[this.waveIndex];
  }

  get state() {
    const wave = this.currentWave;

    return Object.freeze({
      wave: wave.number,
      totalWaves: this.config.definitions.length,
      enemy: this.enemyNumber,
      enemiesInWave: wave.enemyCount,
      status: this.status,
      remainingDelaySeconds:
        this.status === 'between-enemies' || this.status === 'between-waves'
          ? this.remainingDelaySeconds
          : 0,
      moveSpeed: wave.moveSpeed,
      typeIds: Object.freeze([...wave.typeIds]),
    });
  }

  get spawnSettings() {
    const wave = this.currentWave;

    return Object.freeze({
      moveSpeed: wave.moveSpeed,
      typeIds: Object.freeze([...wave.typeIds]),
    });
  }

  completeEnemy() {
    if (this.status !== 'active') {
      return false;
    }

    const wave = this.currentWave;

    if (this.enemyNumber < wave.enemyCount) {
      this.enemyNumber += 1;
      this.status = 'between-enemies';
      this.remainingDelaySeconds = wave.spawnIntervalSeconds;
      return true;
    }

    if (this.waveIndex < this.config.definitions.length - 1) {
      this.waveIndex += 1;
      this.enemyNumber = 1;
      this.status = 'between-waves';
      this.remainingDelaySeconds = this.config.interWaveDelaySeconds;
      return true;
    }

    this.status = 'complete';
    this.remainingDelaySeconds = 0;
    return true;
  }

  update(deltaSeconds, { active = true } = {}) {
    const numericDelta = Number(deltaSeconds);

    if (!Number.isFinite(numericDelta) || numericDelta < 0) {
      throw new RangeError('WaveManager requer delta não negativo e finito.');
    }

    if (typeof active !== 'boolean') {
      throw new TypeError('WaveManager requer active booleano.');
    }

    if (!active || this.status === 'complete') {
      return Object.freeze({ enemyDelta: 0, spawned: false });
    }

    if (this.status === 'active') {
      return Object.freeze({ enemyDelta: numericDelta, spawned: false });
    }

    const remainingBeforeUpdate = this.remainingDelaySeconds;
    this.remainingDelaySeconds = Math.max(
      0,
      remainingBeforeUpdate - numericDelta,
    );

    if (this.remainingDelaySeconds > 0) {
      return Object.freeze({ enemyDelta: 0, spawned: false });
    }

    this.status = 'active';
    return Object.freeze({
      enemyDelta: Math.max(0, numericDelta - remainingBeforeUpdate),
      spawned: true,
    });
  }

  reset() {
    this.waveIndex = 0;
    this.enemyNumber = 1;
    this.status = 'active';
    this.remainingDelaySeconds = 0;
    return true;
  }
}
