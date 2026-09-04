import assert from 'node:assert/strict';
import test from 'node:test';

import { describeWaveState } from './wave-hud.js';

function createState(overrides = {}) {
  return {
    wave: 2,
    totalWaves: 4,
    enemy: 3,
    enemiesInWave: 4,
    status: 'active',
    ...overrides,
  };
}

test('descreve onda e inimigo ativos dentro das cinco etapas da fase', () => {
  assert.deepEqual(describeWaveState(createState()), {
    label: 'Onda 2 de 4',
    detail: 'Inimigo 3 de 4',
    stageValue: 2,
    stageMax: 5,
    hudState: 'active',
    ariaLabel: 'Etapa 2 de 5: onda 2 de 4, inimigo 3 de 4',
  });
});

test('diferencia intervalos entre inimigos e ondas', () => {
  assert.equal(
    describeWaveState(createState({ status: 'between-enemies' })).detail,
    'Próximo: inimigo 3 de 4',
  );
  assert.equal(
    describeWaveState(createState({ status: 'between-waves' })).detail,
    'Próxima: onda 2',
  );
});

test('representa preparação, retorno, confronto e conclusão do chefão', () => {
  const pending = createState({ wave: 4, status: 'boss-pending' });

  assert.deepEqual(describeWaveState(pending), {
    label: 'Chefão final',
    detail: 'Preparando confronto',
    stageValue: 4,
    stageMax: 5,
    hudState: 'boss-pending',
    ariaLabel: 'Etapa 4 de 5: chefão final, preparando confronto',
  });
  assert.equal(
    describeWaveState(pending, { bossReturning: true }).detail,
    'Preparando retorno',
  );
  const boss = describeWaveState(createState({ wave: 4, status: 'boss' }));
  assert.equal(boss.stageValue, 5);
  assert.equal(boss.detail, '10 acertos necessários');
  assert.equal(
    describeWaveState(createState({ wave: 4, status: 'complete' })).label,
    'Fase concluída',
  );
});

test('rejeita estados incompletos ou desconhecidos', () => {
  assert.throws(() => describeWaveState(), /inválido/);
  assert.throws(
    () => describeWaveState(createState({ status: 'paused' })),
    /inválido/,
  );
  assert.throws(
    () => describeWaveState(createState({ enemy: 0 })),
    /enemy/,
  );
  assert.throws(
    () => describeWaveState(createState({ wave: 5 })),
    /totalWaves/,
  );
  assert.throws(
    () => describeWaveState(createState({ enemy: 5 })),
    /enemiesInWave/,
  );
  assert.throws(
    () => describeWaveState(createState(), { bossReturning: 'yes' }),
    /booleano/,
  );
});
