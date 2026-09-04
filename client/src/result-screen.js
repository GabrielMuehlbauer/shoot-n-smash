import { GAME_STATES } from './gameplay/GameStateManager.js';

export const PLAYER_NAME_MAX_LENGTH = 24;
export const DEFAULT_PLAYER_NAME = 'Jogador';

export function normalizePlayerName(
  value,
  {
    fallback = DEFAULT_PLAYER_NAME,
    maxLength = PLAYER_NAME_MAX_LENGTH,
  } = {},
) {
  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    throw new RangeError('O limite do nome deve ser um inteiro positivo.');
  }

  if (typeof fallback !== 'string' || fallback.trim() === '') {
    throw new TypeError('O nome alternativo do jogador deve ser preenchido.');
  }

  const normalized = typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ')
    : '';
  const selected = normalized || fallback.trim().replace(/\s+/g, ' ');

  return Array.from(selected).slice(0, maxLength).join('');
}

export function describeMatchResult({
  gameState,
  playerName,
  scenario,
  score,
} = {}) {
  const status = gameState?.status ?? gameState;

  if (![GAME_STATES.VICTORY, GAME_STATES.GAME_OVER].includes(status)) {
    throw new RangeError('A tela final requer um estado terminal da partida.');
  }

  if (typeof scenario !== 'string' || scenario.trim() === '') {
    throw new TypeError('A tela final requer um cenário preenchido.');
  }

  if (!Number.isInteger(score) || score < 0) {
    throw new RangeError('A tela final requer uma pontuação inteira não negativa.');
  }

  const victory = status === GAME_STATES.VICTORY;

  return Object.freeze({
    kind: victory ? 'victory' : 'defeat',
    eyebrow: victory ? 'Região de neve concluída' : 'A ilha venceu esta rodada',
    title: victory ? 'Vitória!' : 'Fim de jogo',
    message: victory
      ? 'Você sobreviveu às quatro ondas e derrotou o chefão de gelo.'
      : 'Sua vida chegou a zero. Reorganize sua mira e tente novamente.',
    playerName: normalizePlayerName(playerName),
    resultText: victory ? 'Vitória' : 'Derrota',
    scenario: scenario.trim(),
    scoreText: score.toLocaleString('pt-BR'),
  });
}
