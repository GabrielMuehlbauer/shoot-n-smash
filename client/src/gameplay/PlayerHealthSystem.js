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
  constructor({
    config = GAMEPLAY_CONFIG.player,
    onHealthChange = () => {},
  } = {}) {
    validateConfig(config);

    if (typeof onHealthChange !== 'function') {
      throw new TypeError(
        'PlayerHealthSystem requer onHealthChange como função.',
      );
    }

    this.config = Object.freeze({
      initialHealth: config.initialHealth,
      maxHealth: config.maxHealth,
    });
    this.onHealthChange = onHealthChange;
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

  applyDamage(amount) {
    this.assertNotDisposed();

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new RangeError('O dano deve ser um inteiro positivo.');
    }

    if (this.currentHealth === 0) {
      return false;
    }

    const previousHealth = this.currentHealth;
    this.currentHealth = Math.max(0, previousHealth - amount);
    const change = Object.freeze({
      ...this.state,
      damage: previousHealth - this.currentHealth,
      requestedDamage: amount,
    });

    this.onHealthChange(change);
    return change;
  }

  reset() {
    if (this.disposed) {
      return false;
    }

    this.currentHealth = this.config.initialHealth;
    return true;
  }

  assertNotDisposed() {
    if (this.disposed) {
      throw new Error('O sistema de vida do jogador foi descartado.');
    }
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.onHealthChange = () => {};
    this.disposed = true;
    return true;
  }
}
