import assert from 'node:assert/strict';
import test from 'node:test';

import { describeScoreState } from './score-hud.js';

test('descreve o placar inicial e recompensas da partida', () => {
  assert.deepEqual(
    describeScoreState({ score: 0, eventCount: 0, lastEvent: null }),
    {
      eventType: 'initial',
      message: 'Elimine monstros para pontuar.',
      valueText: '0',
    },
  );

  assert.deepEqual(
    describeScoreState({
      score: 2350,
      eventCount: 4,
      lastEvent: {
        id: 'boss:eliminated',
        type: 'enemy-eliminated:boss',
        points: 2000,
      },
    }),
    {
      eventType: 'enemy-eliminated:boss',
      message: '+2.000 · Chefão eliminado',
      valueText: '2.350',
    },
  );
});

test('rejeita estados e eventos de pontuacao invalidos', () => {
  assert.throws(
    () => describeScoreState({ score: -1, eventCount: 0, lastEvent: null }),
    /pontuação/,
  );
  assert.throws(
    () => describeScoreState({ score: 10, eventCount: 0, lastEvent: null }),
    /começar em zero/,
  );
  assert.throws(
    () =>
      describeScoreState({
        score: 10,
        eventCount: 1,
        lastEvent: { type: 'unknown', points: 10 },
      }),
    /evento/,
  );
});
