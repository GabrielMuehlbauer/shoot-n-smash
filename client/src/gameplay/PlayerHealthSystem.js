import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';

function validateConfig(config) {
  if (!Number.isInteger(config?.maxHealth) || config.maxHealth <= 0) {
    throw new RangeError('player.maxHealth deve ser um inteiro positivo.');
  }

  if (
    !Number.isInteger(config.initialHealth) ||
    config.initialHealth < 0 ||
    config.initialHealth > config.maxHealth
  ) {
    throw new RangeError(
      'player.initialHealth deve estar entre zero e player.maxHealth.',
    );
  }
}

export class PlayerHealthSystem {
  constructor({ config = GAMEPLAY_CONFIG.player } = {}) {
    validateConfig(config);

    this.config = Object.freeze({
      initialHealth: config.initialHealth,
      maxHealth: config.maxHealth,
    });
    this.currentHealth = this.config.initialHealth;
    this.disposed = false;
  }

  get health() {
    return this.currentHealth;
  }

  get maxHealth() {
    return this.config.maxHealth;
  }

  get state() {
    return Object.freeze({
      health: this.currentHealth,
      maxHealth: this.maxHealth,
      ratio: this.currentHealth / this.maxHealth,
      depleted: this.currentHealth === 0,
    });
  }

  reset() {
    if (this.disposed) {
      return false;
    }

    this.currentHealth = this.config.initialHealth;
    return true;
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.disposed = true;
    return true;
  }
}
