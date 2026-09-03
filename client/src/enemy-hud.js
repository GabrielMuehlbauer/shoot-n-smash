const ENEMY_OUTCOMES = new Set([null, 'eliminated', 'player-contact']);

function validateEnemyState({
  active,
  maxResistance,
  outcome,
  resistance,
  type,
} = {}) {
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

  if (
    !type ||
    typeof type.id !== 'string' ||
    type.id.trim() === '' ||
    type.id !== type.id.trim() ||
    typeof type.label !== 'string' ||
    type.label.trim() === '' ||
    type.label !== type.label.trim() ||
    !Number.isInteger(type.damage) ||
    type.damage <= 0
  ) {
    throw new TypeError(
      'O estado do inimigo requer um tipo com id, label e damage.',
    );
  }
}

export function describeEnemyState(state) {
  validateEnemyState(state);

  const { active, maxResistance, outcome, resistance, type } = state;
  const percent = Math.round((resistance / maxResistance) * 100);
  const valueText = `${resistance} / ${maxResistance}`;
  const typeLabel = type.label.trim();
  const typeName = typeLabel.toLocaleLowerCase('pt-BR');
  const subject = type.id === 'boss' ? 'Chefão de gelo' : `Inimigo ${typeName}`;
  const sharedDescription = {
    labelText: subject,
    percent,
    typeId: type.id,
    typeLabel,
    valueText,
  };

  if (outcome === 'eliminated') {
    return Object.freeze({
      ...sharedDescription,
      ariaText: `${subject} eliminado, sem resistência`,
      hudState: 'eliminated',
      message: `${subject} eliminado.`,
    });
  }

  if (outcome === 'player-contact') {
    return Object.freeze({
      ...sharedDescription,
      ariaText: `${subject} alcançou o jogador e causou ${type.damage} de dano`,
      hudState: 'player-contact',
      message: `${subject} alcançou o jogador e causou ${type.damage} de dano.`,
    });
  }

  if (!active) {
    return Object.freeze({
      ...sharedDescription,
      ariaText: `${subject} inativo com ${resistance} de ${maxResistance} pontos de resistência`,
      hudState: 'inactive',
      message: `O encontro com ${subject.toLocaleLowerCase('pt-BR')} está encerrado.`,
    });
  }

  const damaged = resistance < maxResistance;

  return Object.freeze({
    ...sharedDescription,
    ariaText: `${subject} com ${resistance} de ${maxResistance} pontos de resistência`,
    hudState: damaged ? 'damaged' : 'active',
    message: damaged
      ? `Impacto em ${subject.toLocaleLowerCase('pt-BR')}. Restam ${resistance} de ${maxResistance} pontos de resistência.`
      : `${subject} se aproximando. Localize-o em 360° e acerte antes do contato.`,
  });
}
