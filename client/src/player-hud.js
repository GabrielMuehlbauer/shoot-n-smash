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

  return Object.freeze({
    ariaText: `Vida do jogador: ${health} de ${maxHealth}`,
    message: `Vida do jogador: ${health} de ${maxHealth} pontos.`,
    percent,
    valueText,
  });
}
