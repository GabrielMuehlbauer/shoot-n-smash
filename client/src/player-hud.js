function validatePlayerState({ health, maxHealth } = {}) {
  if (!Number.isInteger(maxHealth) || maxHealth <= 0) {
    throw new RangeError(
      'O estado do jogador requer maxHealth inteiro e positivo.',
    );
  }

  if (!Number.isInteger(health) || health < 0 || health > maxHealth) {
    throw new RangeError(
      'A vida do jogador deve estar entre zero e maxHealth.',
    );
  }
}

export function describePlayerHealth(state) {
  validatePlayerState(state);

  const { health, maxHealth } = state;
  const percent = Math.round((health / maxHealth) * 100);
  const valueText = `${health} / ${maxHealth}`;

  if (health === maxHealth) {
    return Object.freeze({
      ariaText: `Vida do jogador completa: ${health} de ${maxHealth}`,
      hudState: 'healthy',
      message: `Vida completa. ${health} de ${maxHealth} pontos.`,
      percent,
      valueText,
    });
  }

  if (health === 0) {
    return Object.freeze({
      ariaText: `Vida do jogador esgotada: 0 de ${maxHealth}`,
      hudState: 'depleted',
      message: `Vida esgotada. 0 de ${maxHealth} pontos.`,
      percent,
      valueText,
    });
  }

  return Object.freeze({
    ariaText: `Vida do jogador: ${health} de ${maxHealth}`,
    hudState: 'damaged',
    message: `Jogador ferido. Restam ${health} de ${maxHealth} pontos.`,
    percent,
    valueText,
  });
}
