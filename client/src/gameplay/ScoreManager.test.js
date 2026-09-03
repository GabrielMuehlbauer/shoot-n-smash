import assert from 'node:assert/strict';
import test from 'node:test';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { ScoreManager } from './ScoreManager.js';

test('centraliza e aplica todos os valores de pontuacao da fase', () => {
  const changes = [];
  const manager = new ScoreManager({
    onScoreChange: (state) => changes.push(state),
  });

  assert.deepEqual(GAMEPLAY_CONFIG.score.enemyElimination, {
    weak: 100,
    medium: 250,
    resistant: 500,
    boss: 2000,
  });
  manager.recordEnemyEliminated({ eventId: 'enemy:1:1', typeId: 'weak' });
  manager.recordEnemyEliminated({ eventId: 'enemy:2:1', typeId: 'medium' });
  manager.recordEnemyEliminated({ eventId: 'enemy:3:1', typeId: 'resistant' });
  manager.recordWaveCompleted({ eventId: 'wave:1' });
  manager.recordEnemyEliminated({ eventId: 'boss:eliminated', typeId: 'boss' });
  manager.recordPhaseCompleted({ eventId: 'phase:completed' });

  assert.equal(manager.score, 4350);
  assert.equal(manager.state.eventCount, 6);
  assert.equal(changes.length, 6);
  assert.equal(changes.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(manager.state.lastEvent), true);
  assert.deepEqual(manager.state.lastEvent, {
    id: 'phase:completed',
    type: 'phase-completed',
    points: 1000,
  });
});

test('ignora o mesmo evento sem conceder pontos ou publicar novamente', () => {
  let changeCount = 0;
  const manager = new ScoreManager({
    onScoreChange: () => {
      changeCount += 1;
    },
  });

  assert.ok(
    manager.recordEnemyEliminated({ eventId: 'enemy:1:1', typeId: 'weak' }),
  );
  assert.equal(
    manager.recordEnemyEliminated({ eventId: 'enemy:1:1', typeId: 'weak' }),
    false,
  );
  assert.equal(manager.score, 100);
  assert.equal(manager.state.eventCount, 1);
  assert.equal(changeCount, 1);
});

test('preserva a pontuacao quando o observador falha', () => {
  const failure = new Error('falha no HUD');
  const manager = new ScoreManager({
    onScoreChange: () => {
      throw failure;
    },
  });

  assert.throws(
    () => manager.recordWaveCompleted({ eventId: 'wave:1' }),
    failure,
  );
  assert.equal(manager.score, 500);
  assert.equal(manager.recordWaveCompleted({ eventId: 'wave:1' }), false);
});

test('valida configuracao e eventos invalidos', () => {
  assert.throws(
    () => new ScoreManager({ config: { ...GAMEPLAY_CONFIG.score, waveCompleted: -1 } }),
    /waveCompleted/,
  );
  assert.throws(
    () => new ScoreManager({ onScoreChange: null }),
    /onScoreChange/,
  );

  const manager = new ScoreManager();
  assert.throws(
    () => manager.recordEnemyEliminated({ eventId: 'x', typeId: 'ghost' }),
    /desconhecido/,
  );
  assert.throws(() => manager.recordWaveCompleted({ eventId: '' }), /eventId/);
});

test('reset e dispose encerram o ciclo de vida de forma idempotente', () => {
  const manager = new ScoreManager();
  manager.recordWaveCompleted({ eventId: 'wave:1' });
  assert.equal(manager.reset(), true);
  assert.deepEqual(manager.state, { score: 0, eventCount: 0, lastEvent: null });
  assert.equal(manager.dispose(), true);
  assert.equal(manager.dispose(), false);
  assert.equal(manager.reset(), false);
  assert.throws(
    () => manager.recordPhaseCompleted({ eventId: 'phase:completed' }),
    /descartado/,
  );
});
