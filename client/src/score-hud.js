const EVENT_LABELS = Object.freeze({
  'enemy-eliminated:weak': 'Monstro fraco eliminado',
  'enemy-eliminated:medium': 'Monstro médio eliminado',
  'enemy-eliminated:resistant': 'Monstro resistente eliminado',
  'enemy-eliminated:boss': 'Chefão eliminado',
  'wave-completed': 'Onda concluída',
  'phase-completed': 'Fase concluída',
});

export function describeScoreState(state) {
  const score = Number(state?.score);
  const eventCount = Number(state?.eventCount);

  if (!Number.isInteger(score) || score < 0) {
    throw new RangeError('O HUD requer pontuação inteira não negativa.');
  }

  if (!Number.isInteger(eventCount) || eventCount < 0) {
    throw new RangeError('O HUD requer contagem de eventos não negativa.');
  }

  if (state.lastEvent === null) {
    if (eventCount !== 0 || score !== 0) {
      throw new RangeError('Pontuação sem evento anterior deve começar em zero.');
    }

    return Object.freeze({
      eventType: 'initial',
      message: 'Elimine monstros para pontuar.',
      valueText: '0',
    });
  }

  const { points, type } = state.lastEvent ?? {};

  if (!Number.isInteger(points) || points < 0 || !EVENT_LABELS[type]) {
    throw new TypeError('O HUD recebeu um evento de pontuação inválido.');
  }

  return Object.freeze({
    eventType: type,
    message: `+${points.toLocaleString('pt-BR')} · ${EVENT_LABELS[type]}`,
    valueText: score.toLocaleString('pt-BR'),
  });
}
