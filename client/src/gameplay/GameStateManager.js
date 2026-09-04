const GAME_STATE_VALUES = [
  'PLAYING',
  'VICTORY',
  'GAME_OVER',
];

const WAVE_STATUS_VALUES = [
  'active',
  'between-enemies',
  'between-waves',
  'boss-pending',
  'boss',
  'complete',
];

export const GAME_STATES = Object.freeze(
  Object.fromEntries(GAME_STATE_VALUES.map((state) => [state, state])),
);

const WAVE_STATUS_SET = new Set(WAVE_STATUS_VALUES);

function validateSnapshot({ enemyState, playerState, waveState } = {}) {
  if (
    !Number.isInteger(playerState?.health) ||
    !Number.isInteger(playerState?.maxHealth) ||
    playerState.maxHealth <= 0 ||
    playerState.health < 0 ||
    playerState.health > playerState.maxHealth
  ) {
    throw new RangeError('GameStateManager recebeu uma vida de jogador inválida.');
  }

  if (!WAVE_STATUS_SET.has(waveState?.status)) {
    throw new RangeError('GameStateManager recebeu um estado de onda inválido.');
  }

  if (
    !enemyState?.type ||
    typeof enemyState.type.id !== 'string' ||
    ![null, 'eliminated', 'player-contact'].includes(enemyState.outcome)
  ) {
    throw new TypeError('GameStateManager recebeu um estado de inimigo inválido.');
  }
}

export function resolveGameState(snapshot) {
  validateSnapshot(snapshot);
  const { enemyState, playerState, waveState } = snapshot;

  if (playerState.health <= 0) {
    return GAME_STATES.GAME_OVER;
  }

  if (
    waveState.status === 'complete' &&
    enemyState.type.id === 'boss' &&
    enemyState.outcome === 'eliminated'
  ) {
    return GAME_STATES.VICTORY;
  }

  return GAME_STATES.PLAYING;
}

export class GameStateManager {
  constructor({ onStateChange = () => {} } = {}) {
    if (typeof onStateChange !== 'function') {
      throw new TypeError('GameStateManager requer onStateChange como função.');
    }

    this.currentState = GAME_STATES.PLAYING;
    this.onStateChange = onStateChange;
    this.disposed = false;
  }

  get state() {
    return Object.freeze({
      status: this.currentState,
      terminal:
        this.currentState === GAME_STATES.VICTORY ||
        this.currentState === GAME_STATES.GAME_OVER,
      result:
        this.currentState === GAME_STATES.VICTORY
          ? 'victory'
          : this.currentState === GAME_STATES.GAME_OVER
            ? 'defeat'
            : null,
    });
  }

  get isTerminal() {
    return this.state.terminal;
  }

  sync(snapshot) {
    this.assertNotDisposed();

    if (this.isTerminal) {
      return false;
    }

    const nextState = resolveGameState(snapshot);

    if (nextState === this.currentState) {
      return false;
    }

    const previousStatus = this.currentState;
    this.currentState = nextState;
    const change = Object.freeze({
      ...this.state,
      previousStatus,
    });

    this.onStateChange(change);
    return change;
  }

  assertNotDisposed() {
    if (this.disposed) {
      throw new Error('O gerenciador de estado da partida foi descartado.');
    }
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.onStateChange = () => {};
    this.disposed = true;
    return true;
  }
}
