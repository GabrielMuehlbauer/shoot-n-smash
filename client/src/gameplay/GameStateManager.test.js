import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GAME_STATES,
  GameStateManager,
  resolveGameState,
} from './GameStateManager.js';

function createSnapshot({
  enemyId = 'weak',
  enemyOutcome = null,
  health = 100,
  waveStatus = 'active',
} = {}) {
  return {
    enemyState: {
      outcome: enemyOutcome,
      type: { id: enemyId },
    },
    playerState: {
      health,
      maxHealth: 100,
    },
    waveState: {
      status: waveStatus,
    },
  };
}

test('mantem PLAYING durante ondas, intervalos e tentativas do chefao', () => {
  assert.equal(resolveGameState(createSnapshot()), GAME_STATES.PLAYING);
  assert.equal(
    resolveGameState(createSnapshot({ waveStatus: 'between-waves' })),
    GAME_STATES.PLAYING,
  );
  assert.equal(
    resolveGameState(createSnapshot({ waveStatus: 'boss-pending' })),
    GAME_STATES.PLAYING,
  );
  assert.equal(
    resolveGameState(
      createSnapshot({ enemyId: 'boss', waveStatus: 'boss' }),
    ),
    GAME_STATES.PLAYING,
  );
  assert.equal(
    resolveGameState(
      createSnapshot({
        enemyId: 'boss',
        enemyOutcome: 'player-contact',
        waveStatus: 'boss-pending',
      }),
    ),
    GAME_STATES.PLAYING,
  );
});

test('vitoria exige chefao eliminado e derrota exige vida zerada', () => {
  assert.equal(
    resolveGameState(
      createSnapshot({
        enemyId: 'boss',
        enemyOutcome: 'eliminated',
        waveStatus: 'complete',
      }),
    ),
    GAME_STATES.VICTORY,
  );
  assert.equal(
    resolveGameState(
      createSnapshot({
        enemyId: 'boss',
        enemyOutcome: 'player-contact',
        waveStatus: 'complete',
      }),
    ),
    GAME_STATES.PLAYING,
  );
  assert.equal(
    resolveGameState(createSnapshot({ health: 0 })),
    GAME_STATES.GAME_OVER,
  );
});

test('publica apenas transicoes reais e torna resultado terminal idempotente', () => {
  const changes = [];
  const manager = new GameStateManager({
    onStateChange: (state) => changes.push(state),
  });

  assert.deepEqual(manager.state, {
    status: 'PLAYING',
    terminal: false,
    result: null,
  });
  assert.equal(manager.sync(createSnapshot()), false);
  assert.equal(
    manager.sync(createSnapshot({ waveStatus: 'between-waves' })),
    false,
  );
  const terminal = manager.sync(createSnapshot({ health: 0 }));

  assert.deepEqual(terminal, {
    status: 'GAME_OVER',
    terminal: true,
    result: 'defeat',
    previousStatus: 'PLAYING',
  });
  assert.equal(Object.isFrozen(terminal), true);
  assert.equal(manager.sync(createSnapshot({ health: 100 })), false);
  assert.equal(changes.length, 1);
});

test('preserva a transicao quando o observador falha', () => {
  const failure = new Error('falha simulada');
  const manager = new GameStateManager({
    onStateChange: () => {
      throw failure;
    },
  });

  assert.throws(
    () => manager.sync(createSnapshot({ health: 0 })),
    (error) => error === failure,
  );
  assert.equal(manager.state.status, GAME_STATES.GAME_OVER);
  assert.equal(manager.isTerminal, true);
});

test('valida snapshots, callback e lifecycle', () => {
  assert.throws(
    () => new GameStateManager({ onStateChange: null }),
    /onStateChange/,
  );
  assert.throws(
    () => resolveGameState(createSnapshot({ health: -1 })),
    /vida de jogador/,
  );
  assert.throws(
    () => resolveGameState(createSnapshot({ waveStatus: 'fim' })),
    /estado de onda/,
  );

  const manager = new GameStateManager();
  assert.equal(manager.dispose(), true);
  assert.equal(manager.dispose(), false);
  assert.throws(() => manager.sync(createSnapshot()), /descartado/);
});
