const KNOWN_STATUSES = new Set([
  'active',
  'between-enemies',
  'between-waves',
  'boss-pending',
  'boss',
  'complete',
]);

function requirePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${field} deve ser um inteiro positivo.`);
  }
}

export function describeWaveState(state, { bossReturning = false } = {}) {
  if (!state || !KNOWN_STATUSES.has(state.status)) {
    throw new TypeError('Estado de onda inválido para o HUD.');
  }

  requirePositiveInteger(state.wave, 'wave');
  requirePositiveInteger(state.totalWaves, 'totalWaves');
  requirePositiveInteger(state.enemy, 'enemy');
  requirePositiveInteger(state.enemiesInWave, 'enemiesInWave');

  if (state.wave > state.totalWaves) {
    throw new RangeError('wave não pode ultrapassar totalWaves.');
  }

  if (state.enemy > state.enemiesInWave) {
    throw new RangeError('enemy não pode ultrapassar enemiesInWave.');
  }

  if (typeof bossReturning !== 'boolean') {
    throw new TypeError('bossReturning deve ser booleano.');
  }

  const stageMax = state.totalWaves + 1;
  let label = `Onda ${state.wave} de ${state.totalWaves}`;
  let detail = `Inimigo ${state.enemy} de ${state.enemiesInWave}`;
  let stageValue = Math.min(state.wave, state.totalWaves);

  if (state.status === 'between-enemies') {
    detail = `Próximo: inimigo ${state.enemy} de ${state.enemiesInWave}`;
  } else if (state.status === 'between-waves') {
    detail = `Próxima: onda ${state.wave}`;
  } else if (state.status === 'boss-pending') {
    label = 'Chefão final';
    detail = bossReturning ? 'Preparando retorno' : 'Preparando confronto';
    stageValue = state.totalWaves;
  } else if (state.status === 'boss') {
    label = 'Chefão final';
    detail = '10 acertos necessários';
    stageValue = stageMax;
  } else if (state.status === 'complete') {
    label = 'Fase concluída';
    detail = 'Confronto encerrado';
    stageValue = stageMax;
  }

  return Object.freeze({
    label,
    detail,
    stageValue,
    stageMax,
    hudState: state.status,
    ariaLabel: `Etapa ${stageValue} de ${stageMax}: ${label.toLocaleLowerCase('pt-BR')}, ${detail.toLocaleLowerCase('pt-BR')}`,
  });
}
