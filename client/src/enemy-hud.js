const ENEMY_OUTCOMES = new Set([null, 'eliminated', 'player-contact']);

function validateEnemyState({ active, maxResistance, outcome, resistance } = {}) {
  if (typeof active !== 'boolean') {
    throw new TypeError('O estado do inimigo requer active booleano.');
  }

  if (!Number.isInteger(maxResistance) || maxResistance <= 0) {
    throw new RangeError(
      'O estado do inimigo requer maxResistance inteiro e positivo.',
    );
  }

  if (
    !Number.isInteger(resistance) ||
    resistance < 0 ||
    resistance > maxResistance
  ) {
    throw new RangeError(
      'A resistência do inimigo deve estar entre zero e maxResistance.',
    );
  }

  if (!ENEMY_OUTCOMES.has(outcome)) {
    throw new RangeError('O estado do inimigo possui um desfecho inválido.');
  }
}

export function describeEnemyState(state) {
  validateEnemyState(state);

  const { active, maxResistance, outcome, resistance } = state;
  const percent = Math.round((resistance / maxResistance) * 100);
  const valueText = `${resistance} / ${maxResistance}`;

  if (outcome === 'eliminated') {
    return Object.freeze({
      ariaText: 'Inimigo eliminado, sem resistência',
      hudState: 'eliminated',
      message: 'Inimigo eliminado. Abra uma nova sessão para gerar outro spawn.',
      percent,
      valueText,
    });
  }

  if (outcome === 'player-contact') {
    return Object.freeze({
      ariaText: `Inimigo alcançou o jogador com ${resistance} de ${maxResistance} pontos de resistência`,
      hudState: 'player-contact',
      message:
        'O inimigo alcançou o jogador. Nesta fase, o contato encerra o encontro sem reduzir vida.',
      percent,
      valueText,
    });
  }

  if (!active) {
    return Object.freeze({
      ariaText: `Inimigo inativo com ${resistance} de ${maxResistance} pontos de resistência`,
      hudState: 'inactive',
      message: 'O encontro com o inimigo está encerrado.',
      percent,
      valueText,
    });
  }

  const damaged = resistance < maxResistance;

  return Object.freeze({
    ariaText: `Inimigo com ${resistance} de ${maxResistance} pontos de resistência`,
    hudState: damaged ? 'damaged' : 'active',
    message: damaged
      ? `Impacto confirmado. Restam ${resistance} de ${maxResistance} pontos de resistência.`
      : 'Monstro de gelo se aproximando. Localize-o em 360° e acerte antes do contato.',
    percent,
    valueText,
  });
}
