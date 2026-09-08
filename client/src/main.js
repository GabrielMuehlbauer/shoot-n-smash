import { describeApiHealth } from './api-health.js';
import {
  MatchApiClient,
  createMatchSubmission,
  createSubmissionId,
  formatMatchDuration,
  formatRankingDate,
} from './api/match-api.js';
import { GAMEPLAY_CONFIG } from './config/gameplay-config.js';
import { GameApp } from './core/GameApp.js';
import { GameSession } from './core/GameSession.js';
import { RenderContext } from './core/RenderContext.js';
import { describeEnemyState } from './enemy-hud.js';
import { DesktopFireController } from './input/DesktopFireController.js';
import { DesktopLookController } from './input/DesktopLookController.js';
import { describePlayerHealth } from './player-hud.js';
import { PROJECT_INFO } from './project-info.js';
import {
  describeMatchResult,
  normalizePlayerName,
} from './result-screen.js';
import { describeScoreState } from './score-hud.js';
import { describeWaveState } from './wave-hud.js';
import { XRPerformanceMonitor } from './xr/XRPerformanceMonitor.js';
import { XRSessionManager } from './xr/XRSessionManager.js';
import { XRSlingshotController } from './xr/XRSlingshotController.js';
import './styles.css';

const teamList = document.querySelector('#team-list');
const apiButton = document.querySelector('#api-status-button');
const apiStatus = document.querySelector('#api-status');
const rankingRefreshButton = document.querySelector('#ranking-refresh-button');
const rankingBody = document.querySelector('#ranking-body');
const rankingStatus = document.querySelector('#ranking-status');
const projectVersion = document.querySelector('#project-version');
const landing = document.querySelector('[data-landing]');
const startSceneButton = document.querySelector('#start-scene-button');
const playerNameInput = document.querySelector('#player-name-input');
const prototypeView = document.querySelector('#prototype-view');
const sceneContainer = document.querySelector('#scene-container');
const sceneError = document.querySelector('#scene-error');
const exitSceneButton = document.querySelector('#exit-scene-button');
const pointerLockButton = document.querySelector('#pointer-lock-button');
const pointerLockStatus = document.querySelector('#pointer-lock-status');
const xrButton = document.querySelector('#xr-button');
const xrStatus = document.querySelector('#xr-status');
const xrDiagnostics = document.querySelector('#xr-diagnostics');
const xrDiagnosticsState = document.querySelector('#xr-diagnostics-state');
const xrDiagnosticsFps = document.querySelector('#xr-diagnostics-fps');
const xrDiagnosticsFrame = document.querySelector('#xr-diagnostics-frame');
const xrDiagnosticsDrawCalls = document.querySelector(
  '#xr-diagnostics-draw-calls',
);
const xrDiagnosticsTriangles = document.querySelector(
  '#xr-diagnostics-triangles',
);
const xrDiagnosticsControllers = document.querySelector(
  '#xr-diagnostics-controllers',
);
const xrDiagnosticsStatus = document.querySelector('#xr-diagnostics-status');
const slingshotHud = document.querySelector('#slingshot-hud');
const slingshotTension = document.querySelector('#slingshot-tension');
const slingshotTensionValue = document.querySelector(
  '#slingshot-tension-value',
);
const slingshotSpeedValue = document.querySelector('#slingshot-speed-value');
const slingshotTrajectoryValue = document.querySelector(
  '#slingshot-trajectory-value',
);
const shotStatus = document.querySelector('#shot-status');
const enemyHud = document.querySelector('#enemy-hud');
const enemyResistance = document.querySelector('#enemy-resistance');
const enemyResistanceLabel = document.querySelector(
  '#enemy-resistance-label',
);
const enemyResistanceValue = document.querySelector(
  '#enemy-resistance-value',
);
const enemyStatus = document.querySelector('#enemy-status');
const waveHud = document.querySelector('#wave-hud');
const waveLabel = document.querySelector('#wave-label');
const waveProgress = document.querySelector('#wave-progress');
const waveMeter = document.querySelector('#wave-meter');
const playerHud = document.querySelector('#player-hud');
const playerHealth = document.querySelector('#player-health');
const playerHealthValue = document.querySelector('#player-health-value');
const playerStatus = document.querySelector('#player-status');
const scoreHud = document.querySelector('#score-hud');
const scoreValue = document.querySelector('#score-value');
const scoreStatus = document.querySelector('#score-status');
const itemHud = document.querySelector('#item-hud');
const itemLabel = document.querySelector('#item-label');
const itemStatus = document.querySelector('#item-status');
const specialAmmoValue = document.querySelector('#special-ammo-value');
const resultScreen = document.querySelector('#result-screen');
const resultEyebrow = document.querySelector('#result-eyebrow');
const resultTitle = document.querySelector('#result-title');
const resultMessage = document.querySelector('#result-message');
const resultPlayerName = document.querySelector('#result-player-name');
const resultOutcome = document.querySelector('#result-outcome');
const resultScore = document.querySelector('#result-score');
const resultScenario = document.querySelector('#result-scenario');
const resultDuration = document.querySelector('#result-duration');
const resultSync = document.querySelector('.result-sync');
const resultSyncStatus = document.querySelector('#result-sync-status');
const resultRetryButton = document.querySelector('#result-retry-button');
const replayButton = document.querySelector('#replay-button');
const resultMenuButton = document.querySelector('#result-menu-button');

let gameApp = null;
let lookController = null;
let fireController = null;
let gameSession = null;
let xrSessionManager = null;
let xrSlingshotController = null;
let xrPerformanceMonitor = null;
let xrActive = false;
let pointerLocked = false;
let announcedChargeStage = -1;
let currentPlayerName = normalizePlayerName('');
let activeMatch = null;
let lastCompletedMatch = null;
let rankingRequestId = 0;
const savingSubmissionIds = new Set();
const matchApi = new MatchApiClient();

for (const member of PROJECT_INFO.team) {
  const item = document.createElement('li');
  item.textContent = member;
  teamList.append(item);
}

projectVersion.textContent = `${PROJECT_INFO.name} · v${PROJECT_INFO.version}`;

function setResultSyncState(state, message, { retry = false } = {}) {
  resultSync.dataset.state = state;
  resultSyncStatus.textContent = message;
  resultRetryButton.hidden = !retry;
  resultRetryButton.disabled = state === 'saving';
}

function renderRanking({ ranking }) {
  const fragment = document.createDocumentFragment();

  if (ranking.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'ranking-empty';
    cell.colSpan = 5;
    cell.textContent = 'Ainda não há partidas registradas. Seja o primeiro!';
    row.append(cell);
    fragment.append(row);
  } else {
    for (const entry of ranking) {
      const row = document.createElement('tr');
      const position = document.createElement('th');
      position.scope = 'row';
      position.textContent = `${entry.posicao}º`;
      row.append(position);

      for (const [value, className = ''] of [
        [entry.nome],
        [entry.pontuacao.toLocaleString('pt-BR'), 'ranking-score'],
        [entry.cenario.charAt(0).toLocaleUpperCase('pt-BR') + entry.cenario.slice(1)],
        [formatRankingDate(entry.data)],
      ]) {
        const cell = document.createElement('td');
        cell.className = className;
        cell.textContent = value;
        row.append(cell);
      }

      fragment.append(row);
    }
  }

  rankingBody.replaceChildren(fragment);
}

async function loadRanking() {
  const requestId = ++rankingRequestId;
  rankingRefreshButton.disabled = true;
  rankingStatus.dataset.state = 'loading';
  rankingStatus.textContent = 'Consultando os melhores resultados…';

  try {
    const result = await matchApi.getRanking({ scenario: 'neve', limit: 10 });

    if (requestId !== rankingRequestId) {
      return false;
    }

    renderRanking(result);
    rankingStatus.dataset.state = 'success';
    rankingStatus.textContent = result.total === 0
      ? 'Ranking pronto para receber a primeira partida.'
      : `Mostrando ${result.ranking.length} de ${result.total} jogadores classificados.`;
    return true;
  } catch (error) {
    if (requestId !== rankingRequestId) {
      return false;
    }

    rankingStatus.dataset.state = 'error';
    rankingStatus.textContent =
      'Não foi possível carregar o ranking. Verifique a API e tente novamente.';
    console.error('Falha ao consultar o ranking.', error);
    return false;
  } finally {
    if (requestId === rankingRequestId) {
      rankingRefreshButton.disabled = false;
    }
  }
}

function completeActiveMatch(state) {
  if (activeMatch?.submission) {
    return activeMatch.submission;
  }

  if (!activeMatch) {
    throw new Error('Não existe uma partida ativa para encerrar.');
  }

  const submission = createMatchSubmission({
    submissionId: activeMatch.submissionId,
    playerName: currentPlayerName,
    score: gameSession.scoreState.score,
    scenario: PROJECT_INFO.scenario,
    result: state.result,
    startedAt: activeMatch.startedAt,
    completedAt: performance.now(),
  });

  activeMatch.submission = submission;
  lastCompletedMatch = submission;
  return submission;
}

async function submitCompletedMatch(match) {
  if (!match || savingSubmissionIds.has(match.submissionId)) {
    return false;
  }

  savingSubmissionIds.add(match.submissionId);
  if (lastCompletedMatch?.submissionId === match.submissionId) {
    setResultSyncState('saving', 'Registrando partida no ranking global…');
  }

  try {
    const result = await matchApi.submitMatch(match);

    if (lastCompletedMatch?.submissionId === match.submissionId) {
      setResultSyncState(
        'success',
        result.duplicate
          ? 'Partida já registrada. Nenhuma pontuação foi duplicada.'
          : 'Partida registrada no ranking global.',
      );
    }

    void loadRanking();
    return true;
  } catch (error) {
    if (lastCompletedMatch?.submissionId === match.submissionId) {
      setResultSyncState(
        'error',
        'Não foi possível registrar agora. Sua tela de resultado continua aberta para tentar novamente.',
        { retry: true },
      );
    }
    console.error('Falha ao registrar a partida.', error);
    return false;
  } finally {
    savingSubmissionIds.delete(match.submissionId);
  }
}

function setShotStatus(state, message) {
  slingshotHud.dataset.state = state;
  shotStatus.dataset.state = state;
  shotStatus.textContent = message;
}

function resetSlingshotHud(state = 'ready') {
  slingshotTension.value = 0;
  slingshotTension.textContent = '0%';
  slingshotTension.setAttribute('aria-valuetext', '0% de tensão');
  slingshotTensionValue.textContent = '0%';
  slingshotSpeedValue.textContent =
    `${GAMEPLAY_CONFIG.projectile.minSpeed.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} u/s`;
  slingshotTrajectoryValue.textContent = 'Segure para prever';
  slingshotHud.dataset.state = state;
  announcedChargeStage = -1;
}

function updateEnemyState(state) {
  const description = describeEnemyState(state);

  enemyHud.dataset.enemyState = description.hudState;
  enemyHud.dataset.enemyType = description.typeId;
  enemyHud.style.setProperty(
    '--enemy-resistance',
    String(description.percent),
  );
  enemyResistanceValue.textContent = description.valueText;
  enemyResistanceLabel.textContent = description.labelText;
  enemyResistance.setAttribute(
    'aria-valuemax',
    String(state.maxResistance),
  );
  enemyResistance.setAttribute('aria-valuenow', String(state.resistance));
  enemyResistance.setAttribute('aria-valuetext', description.ariaText);
  enemyStatus.textContent = description.message;
}

function resetEnemyHud() {
  const defaultType = GAMEPLAY_CONFIG.enemy.types[0];

  updateEnemyState({
    active: true,
    maxResistance: defaultType.maxResistance,
    outcome: null,
    resistance: defaultType.maxResistance,
    type: defaultType,
  });
}

function updatePlayerState(state) {
  const description = describePlayerHealth(state);

  playerHud.dataset.playerState = description.hudState;
  playerHud.style.setProperty('--player-health', String(description.percent));
  playerHealthValue.textContent = description.valueText;
  playerHealth.setAttribute('aria-valuemax', String(state.maxHealth));
  playerHealth.setAttribute('aria-valuenow', String(state.health));
  playerHealth.setAttribute('aria-valuetext', description.ariaText);
  playerStatus.textContent = description.message;
}

function resetPlayerHud() {
  updatePlayerState({
    health: GAMEPLAY_CONFIG.player.initialHealth,
    maxHealth: GAMEPLAY_CONFIG.player.maxHealth,
  });
}

function updateScoreState(state) {
  const description = describeScoreState(state);

  scoreHud.dataset.scoreEvent = description.eventType;
  scoreValue.textContent = description.valueText;
  scoreStatus.textContent = description.message;
}

function resetScoreHud() {
  updateScoreState({ score: 0, eventCount: 0, lastEvent: null });
}

function updateItemState(state) {
  const typeLabel = state.type?.label ?? 'Itens';
  const hudState = state.active ? 'available' : state.outcome ?? 'waiting';

  itemHud.dataset.itemState = hudState;
  itemLabel.textContent = state.active ? typeLabel : 'Itens';

  if (state.active) {
    itemStatus.textContent = `${typeLabel} disponível na arena. Acerte para coletar.`;
  } else if (state.outcome === 'expired') {
    itemStatus.textContent = 'O item desapareceu antes de ser coletado.';
  } else if (state.outcome === 'cleared') {
    itemStatus.textContent = 'Itens encerrados. Prepare-se para o chefão.';
  }
}

function updateSpecialAmmoState(state) {
  itemHud.dataset.specialAmmo = state.active ? 'active' : 'inactive';
  specialAmmoValue.textContent = `${state.remainingShots} especiais`;
  specialAmmoValue.setAttribute(
    'aria-label',
    `${state.remainingShots} disparos especiais restantes`,
  );
}

function handleItemCollected({ effect, item }) {
  itemHud.dataset.itemState = 'collected';
  itemLabel.textContent = item.type.label;

  if (effect.kind === 'heal') {
    itemStatus.textContent = effect.appliedAmount > 0
      ? `Item coletado: +${effect.appliedAmount} de vida.`
      : 'Item de vida coletado, mas a vida já estava completa.';
  } else {
    itemStatus.textContent =
      `Munição especial coletada: +${effect.addedShots} disparos de dano ${effect.hitStrength}.`;
  }
}

function resetItemHud() {
  itemHud.dataset.itemState = 'waiting';
  itemHud.dataset.specialAmmo = 'inactive';
  itemLabel.textContent = 'Itens';
  itemStatus.textContent = 'Acerte itens na arena para coletá-los.';
  updateSpecialAmmoState({ active: false, remainingShots: 0 });
}

function closeResultScreen() {
  if (!resultScreen.open && !resultScreen.hasAttribute('open')) {
    return false;
  }

  if (typeof resultScreen.close === 'function' && resultScreen.open) {
    resultScreen.close();
  } else {
    resultScreen.removeAttribute('open');
  }

  return true;
}

function resetResultScreen() {
  closeResultScreen();
  resultScreen.dataset.result = 'victory';
  resultEyebrow.textContent = 'Partida encerrada';
  resultTitle.textContent = 'Resultado';
  resultMessage.textContent = '';
  resultPlayerName.textContent = currentPlayerName;
  resultOutcome.textContent = '';
  resultScore.textContent = '0';
  resultScenario.textContent = PROJECT_INFO.scenario;
  resultDuration.textContent = '00:00';
  setResultSyncState('idle', 'Preparando registro da partida…');
}

function showResultScreen(state, match) {
  const result = describeMatchResult({
    gameState: state,
    playerName: match.nome,
    scenario: PROJECT_INFO.scenario,
    score: match.pontuacao,
  });

  resultScreen.dataset.result = result.kind;
  resultEyebrow.textContent = result.eyebrow;
  resultTitle.textContent = result.title;
  resultMessage.textContent = result.message;
  resultPlayerName.textContent = result.playerName;
  resultOutcome.textContent = result.resultText;
  resultScore.textContent = result.scoreText;
  resultScenario.textContent = result.scenario;
  resultDuration.textContent = formatMatchDuration(match.duracaoMs);
  resultScreen.dataset.submissionId = match.submissionId;

  if (!resultScreen.open && !resultScreen.hasAttribute('open')) {
    if (typeof resultScreen.showModal === 'function') {
      resultScreen.showModal();
    } else {
      resultScreen.setAttribute('open', '');
    }
  }

  replayButton.focus({ preventScroll: true });
}

function handleGameStateChange(state) {
  prototypeView.dataset.gameState = state.status;

  if (!state.terminal) {
    return false;
  }

  void xrSessionManager?.endSession();

  try {
    gameApp?.stop();
  } catch (error) {
    console.error('Falha ao pausar a partida encerrada.', error);
  }

  resetSlingshotHud('idle');
  setShotStatus(
    state.result === 'victory' ? 'ready' : 'idle',
    state.result === 'victory'
      ? 'Partida concluída com vitória.'
      : 'Partida encerrada: a vida chegou a zero.',
  );
  const completedMatch = completeActiveMatch(state);
  showResultScreen(state, completedMatch);
  void submitCompletedMatch(completedMatch);
  return true;
}

function showEncounterOutcome(outcome = gameSession?.enemyState?.outcome) {
  const waveState = gameSession?.waveState;

  if (outcome === 'eliminated' && waveState) {
    const bossResolved = gameSession.enemyState.type.id === 'boss';
    const nextMessage =
      waveState.status === 'complete'
        ? bossResolved
          ? 'Chefão derrotado. Confronto final encerrado.'
          : 'As quatro ondas foram concluídas.'
        : waveState.status === 'boss-pending'
          ? 'As quatro ondas terminaram. O chefão de gelo surge em instantes.'
        : waveState.status === 'between-waves'
          ? `Onda ${waveState.wave} de ${waveState.totalWaves} em instantes.`
          : `Inimigo ${waveState.enemy} de ${waveState.enemiesInWave} em instantes.`;

    setShotStatus(
      'ready',
      bossResolved ? nextMessage : `Inimigo eliminado. ${nextMessage}`,
    );
    return true;
  }

  if (outcome === 'player-contact' && waveState) {
    const { health, maxHealth } = gameSession.playerState;
    const { damage, label } = gameSession.enemyState.type;
    const bossReturning = gameSession.enemyState.type.id === 'boss';
    const enemyName =
      gameSession.enemyState.type.id === 'boss'
        ? 'chefão de gelo'
        : `inimigo ${label.toLocaleLowerCase('pt-BR')}`;
    const nextMessage =
      waveState.status === 'complete'
        ? 'Confronto final encerrado.'
        : waveState.status === 'boss-pending'
          ? bossReturning
            ? 'O chefão recuou e retornará com resistência total.'
            : 'O chefão de gelo surge em instantes.'
        : waveState.status === 'between-waves'
          ? `Onda ${waveState.wave} de ${waveState.totalWaves} em instantes.`
          : `Inimigo ${waveState.enemy} de ${waveState.enemiesInWave} em instantes.`;

    setShotStatus(
      'idle',
      `O ${enemyName} causou ${damage} de dano. Vida: ${health} / ${maxHealth}. ${nextMessage}`,
    );
    return true;
  }

  return false;
}

function updateWaveState(state) {
  const description = describeWaveState(state, {
    bossReturning: gameSession?.enemyState?.type?.id === 'boss',
  });

  prototypeView.dataset.waveState = state.status;
  waveHud.dataset.waveState = description.hudState;
  waveLabel.textContent = description.label;
  waveProgress.textContent = description.detail;
  waveMeter.max = description.stageMax;
  waveMeter.value = description.stageValue;
  waveMeter.textContent = `Etapa ${description.stageValue} de ${description.stageMax}`;
  waveMeter.setAttribute('aria-label', description.ariaLabel);

  if (state.status === 'boss-pending') {
    showEncounterOutcome();
    return;
  }

  if (state.status === 'boss') {
    updateEnemyState(gameSession.enemyState);
    setShotStatus(
      pointerLocked || xrActive ? 'ready' : 'idle',
      'Chefão de gelo ativo. Acerte-o dez vezes antes do contato.',
    );
    return;
  }

  if (state.status === 'complete') {
    showEncounterOutcome();
    return;
  }

  if (state.status === 'active') {
    updateEnemyState(gameSession.enemyState);
    setShotStatus(
      pointerLocked || xrActive ? 'ready' : 'idle',
      `Onda ${state.wave}. Inimigo ${state.enemy} de ${state.enemiesInWave}: localize-o em 360°.`,
    );
    return;
  }

  showEncounterOutcome();
}

function updateChargeState({ charging, ratio, speed, ammoType = 'normal' }) {
  const normalizedRatio = Math.min(Math.max(Number(ratio) || 0, 0), 1);
  const percent = Math.round(normalizedRatio * 100);

  slingshotTension.value = percent;
  slingshotTension.textContent = `${percent}%`;
  slingshotTension.setAttribute(
    'aria-valuetext',
    `${percent}% de tensão`,
  );
  slingshotTensionValue.textContent = `${percent}%`;
  const safeSpeed = Number.isFinite(speed)
    ? speed
    : GAMEPLAY_CONFIG.projectile.minSpeed +
      (GAMEPLAY_CONFIG.projectile.maxSpeed - GAMEPLAY_CONFIG.projectile.minSpeed) *
        normalizedRatio;
  slingshotSpeedValue.textContent = `${safeSpeed.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} u/s`;
  slingshotTrajectoryValue.textContent = charging
    ? ammoType === 'special'
      ? 'Dourada prevista'
      : 'Prevista na arena'
    : 'Segure para prever';

  if (!charging) {
    resetSlingshotHud(pointerLocked || xrActive ? 'ready' : 'idle');
    showEncounterOutcome();
    return;
  }

  if (showEncounterOutcome()) {
    return;
  }

  const announcementStage = percent === 100 ? 100 : 0;

  if (announcementStage !== announcedChargeStage) {
    announcedChargeStage = announcementStage;
    setShotStatus(
      'charging',
      announcementStage === 100
        ? 'Carga máxima. Solte o botão para disparar.'
        : 'Carregando o estilingue. Solte o botão quando quiser disparar.',
    );
  }
}

function handleShot(shot) {
  const percent = Math.round(Math.min(Math.max(shot.ratio, 0), 1) * 100);
  const projectileLabel =
    shot.activeProjectileCount === 1
      ? '1 projétil ativo'
      : `${shot.activeProjectileCount} projéteis ativos`;
  const ammoLabel = shot.ammoType === 'special'
    ? ` · munição especial com dano ${shot.hitStrength}`
    : '';

  if (showEncounterOutcome()) {
    return;
  }

  setShotStatus(
    'ready',
    `Disparo de ${percent}% lançado · ${projectileLabel}${ammoLabel}.`,
  );
}

function handleEnemyResistanceChange(state) {
  updateEnemyState(state);
}

function handleEnemyEliminate(state) {
  updateEnemyState(state);
  showEncounterOutcome(state.outcome);
}

function handleEnemyPlayerContact(state) {
  updateEnemyState(state);
  showEncounterOutcome(state.outcome);
}

function handleEnemyHit({ maxResistance, outcome, resistance, type }) {
  if (outcome !== null) {
    return;
  }

  setShotStatus(
    'ready',
    `Impacto no inimigo ${type.label.toLocaleLowerCase('pt-BR')}. Restam ${resistance} de ${maxResistance} pontos de resistência.`,
  );
}

function handleChargeCancel({ reason = 'manual' } = {}) {
  gameSession?.cancelCharge();
  resetSlingshotHud(xrActive ? 'ready' : 'idle');

  const messages = {
    'document-hidden': 'Carga cancelada porque a página ficou oculta.',
    'pointer-lock-lost': 'Carga cancelada. Ative a mira para tentar novamente.',
    'window-blur': 'Carga cancelada porque a janela perdeu o foco.',
    'controller-disconnected': 'Carga cancelada porque um controle XR foi desconectado.',
    'invalid-controller-pose': 'Carga cancelada porque o rastreamento das mãos foi perdido.',
    'xr-session-ended': 'Carga cancelada ao sair do modo VR.',
  };

  if (!showEncounterOutcome()) {
    setShotStatus('idle', messages[reason] ?? 'Carga cancelada com segurança.');
  }
}

function updateLookState({ locked, supported }) {
  pointerLocked = locked;
  prototypeView.dataset.lookState = locked
    ? 'locked'
    : supported
      ? 'unlocked'
      : 'unsupported';
  pointerLockButton.hidden = locked;
  pointerLockButton.disabled = !supported;
  pointerLockButton.removeAttribute('aria-busy');
  pointerLockStatus.textContent = locked
    ? 'Mira ativa. Segure o botão esquerdo e solte para disparar; Esc libera o cursor.'
    : supported
      ? 'Cursor livre. Ative a mira para olhar e usar o estilingue.'
      : 'Pointer Lock não está disponível neste navegador.';

  if (xrActive) {
    return;
  }

  if (locked) {
    resetSlingshotHud('ready');
    if (!showEncounterOutcome()) {
      setShotStatus(
        'ready',
        'Mira ativa. Segure o botão esquerdo para carregar.',
      );
    }
  } else {
    gameSession?.cancelCharge();
    resetSlingshotHud('idle');
    if (!showEncounterOutcome()) {
      setShotStatus(
        'idle',
        supported
          ? 'Ative a mira para preparar o estilingue.'
          : 'Disparo indisponível sem suporte a Pointer Lock.',
      );
    }
  }

  if (
    !locked &&
    supported &&
    !prototypeView.hidden &&
    !gameSession?.isTerminal
  ) {
    pointerLockButton.focus({ preventScroll: true });
  }
}

function updateXRInputState({ active, ready }) {
  if (!active) {
    return;
  }

  setShotStatus(
    ready ? 'ready' : 'idle',
    ready
      ? 'Controles XR prontos. Puxe a bola com a mão direita e solte para disparar.'
      : 'Conecte os dois controles: esquerda para o estilingue e direita para a munição.',
  );
}

function resetXRDiagnostics() {
  xrDiagnostics.hidden = true;
  xrDiagnostics.dataset.state = 'idle';
  xrDiagnosticsState.textContent = 'Aguardando sessão';
  xrDiagnosticsFps.textContent = '—';
  xrDiagnosticsFrame.textContent = '—';
  xrDiagnosticsDrawCalls.textContent = '—';
  xrDiagnosticsTriangles.textContent = '—';
  xrDiagnosticsControllers.textContent = '—';
  xrDiagnosticsStatus.textContent =
    'As métricas aparecerão quando uma sessão immersive-vr for iniciada.';
}

function updateXRDiagnostics(report) {
  xrDiagnostics.hidden = false;
  xrDiagnostics.dataset.state = report.state;
  xrDiagnosticsState.textContent =
    report.state === 'active' ? 'Medindo no headset' : 'Sessão encerrada';
  xrDiagnosticsFps.textContent = report.averageFps
    ? `${report.averageFps.toLocaleString('pt-BR')} FPS`
    : 'Coletando…';
  xrDiagnosticsFrame.textContent = report.maxFrameMs
    ? `${report.maxFrameMs.toLocaleString('pt-BR')} ms máx.`
    : 'Coletando…';
  xrDiagnosticsDrawCalls.textContent =
    report.maxDrawCalls.toLocaleString('pt-BR');
  xrDiagnosticsTriangles.textContent =
    report.maxTriangles.toLocaleString('pt-BR');
  xrDiagnosticsControllers.textContent = report.controllers.length
    ? report.controllers
        .map(({ handedness }) =>
          handedness === 'left'
            ? 'esquerdo'
            : handedness === 'right'
              ? 'direito'
              : 'sem mão',
        )
        .join(' + ')
    : 'aguardando';
  xrDiagnosticsStatus.textContent =
    report.state === 'active'
      ? `${report.device} · ${report.slowFramePercent.toLocaleString('pt-BR')}% dos frames acima de ${report.slowFrameThresholdMs} ms.`
      : `${report.device} · ${report.durationSeconds.toLocaleString('pt-BR')} s medidos · mínimo de ${report.minimumFps.toLocaleString('pt-BR')} FPS.`;
}

function setXRActive(active) {
  const nextActive = Boolean(active);

  if (xrActive === nextActive) {
    return false;
  }

  xrActive = nextActive;
  prototypeView.dataset.inputMode = nextActive ? 'xr' : 'desktop';
  gameSession?.setDesktopSlingshotVisible(!nextActive);

  if (nextActive) {
    fireController?.cancelCharge?.('xr-session-started');
    fireController?.disconnect?.();
    lookController?.unlock?.();
    lookController?.disconnect?.();
    pointerLocked = false;
    resetSlingshotHud('ready');
    xrSlingshotController?.setActive(true);
  } else if (gameApp?.isRunning) {
    xrSlingshotController?.setActive(false);
    lookController?.connect?.();
    fireController?.connect?.();
    resetSlingshotHud('idle');
    setShotStatus('idle', 'Ative a mira para preparar o estilingue.');
  } else {
    xrSlingshotController?.setActive(false);
  }

  return true;
}

function updateXRState({ state, supported, presenting }) {
  xrButton.disabled = ['checking', 'starting'].includes(state);
  xrButton.setAttribute('aria-pressed', String(presenting));
  prototypeView.dataset.xrState = state;

  if (state === 'checking') {
    xrButton.textContent = 'Verificando VR…';
    xrStatus.textContent = 'Consultando o suporte WebXR deste dispositivo.';
    return;
  }

  if (state === 'starting') {
    xrButton.textContent = 'Entrando em VR…';
    xrStatus.textContent = 'Autorize o acesso ao headset e aos controles.';
    return;
  }

  if (state === 'presenting') {
    xrPerformanceMonitor?.start({
      session: xrSessionManager?.currentSession,
    });
    setXRActive(true);
    xrButton.textContent = 'Sair do VR';
    xrStatus.textContent = 'Modo imersivo ativo com estilingue de duas mãos.';
    return;
  }

  if (xrActive) {
    xrPerformanceMonitor?.stop({
      reason: state === 'error' ? 'session-error' : 'session-ended',
    });
  }

  setXRActive(false);

  if (state === 'ready' && supported) {
    xrButton.disabled = false;
    xrButton.textContent = 'Entrar em VR';
    xrStatus.textContent = 'WebXR disponível. Use dois controles rastreados.';
    return;
  }

  xrButton.disabled = true;
  xrButton.textContent = 'VR indisponível';
  xrStatus.textContent =
    state === 'error'
      ? 'Não foi possível iniciar o modo imersivo. O modo convencional continua disponível.'
      : 'Este navegador ou dispositivo não oferece immersive-vr.';
}

async function toggleXRSession() {
  if (!xrSessionManager || gameSession?.isTerminal) {
    return;
  }

  if (xrSessionManager.isPresenting) {
    await xrSessionManager.endSession();
  } else {
    await xrSessionManager.startSession();
  }
}

function handleLookError({ message }) {
  fireController?.cancelCharge('look-error');
  gameSession?.cancelCharge();
  pointerLocked = false;
  prototypeView.dataset.lookState = 'error';
  pointerLockButton.hidden = false;
  pointerLockButton.disabled = !lookController?.isSupported;
  pointerLockButton.removeAttribute('aria-busy');
  pointerLockStatus.textContent = message;
  resetSlingshotHud('error');
  setShotStatus('error', 'Carga cancelada porque a mira não está disponível.');

  if (!prototypeView.hidden) {
    (pointerLockButton.disabled ? exitSceneButton : pointerLockButton).focus({
      preventScroll: true,
    });
  }
}

function enterPrototype() {
  let renderContext = null;

  startSceneButton.disabled = true;
  currentPlayerName = normalizePlayerName(playerNameInput.value);
  playerNameInput.value = currentPlayerName;
  landing.hidden = true;
  prototypeView.hidden = false;
  prototypeView.dataset.gameState = 'PLAYING';
  sceneError.hidden = true;
  document.body.classList.add('scene-active');
  resetResultScreen();
  resetEnemyHud();
  resetPlayerHud();
  resetScoreHud();
  resetItemHud();
  resetXRDiagnostics();

  try {
    activeMatch = {
      submissionId: createSubmissionId(),
      startedAt: performance.now(),
      submission: null,
    };
    lastCompletedMatch = null;
    renderContext = new RenderContext(sceneContainer);
    lookController = new DesktopLookController({
      camera: renderContext.camera,
      domElement: renderContext.renderer.domElement,
      onLockChange: updateLookState,
      onError: handleLookError,
    });
    gameSession = new GameSession({
      camera: renderContext.camera,
      scene: renderContext.scene,
      onChargeChange: updateChargeState,
      onEnemyEliminate: handleEnemyEliminate,
      onEnemyHit: handleEnemyHit,
      onEnemyPlayerContact: handleEnemyPlayerContact,
      onEnemyResistanceChange: handleEnemyResistanceChange,
      onGameStateChange: handleGameStateChange,
      onItemCollected: handleItemCollected,
      onItemStateChange: updateItemState,
      onWaveChange: updateWaveState,
      onPlayerHealthChange: updatePlayerState,
      onScoreChange: updateScoreState,
      onShot: handleShot,
      onSpecialAmmoChange: updateSpecialAmmoState,
    });
    updateEnemyState(gameSession.enemyState);
    updateWaveState(gameSession.waveState);
    updatePlayerState(gameSession.playerState);
    updateScoreState(gameSession.scoreState);
    updateItemState(gameSession.itemState);
    updateSpecialAmmoState(gameSession.specialAmmoState);
    handleGameStateChange(gameSession.gameState);
    fireController = new DesktopFireController({
      canvas: renderContext.renderer.domElement,
      onChargeStart: () => gameSession.beginCharge(),
      onChargeRelease: () => gameSession.releaseShot(),
      onChargeCancel: handleChargeCancel,
    });
    xrSlingshotController = new XRSlingshotController({
      renderer: renderContext.renderer,
      scene: renderContext.scene,
      config: GAMEPLAY_CONFIG.xr,
      onChargeStart: ({ mode }) => gameSession.beginCharge({ mode }),
      onChargeChange: (ratio) => gameSession.setChargeRatio(ratio),
      onChargeRelease: (pose) => gameSession.releaseShot(pose),
      onChargeCancel: handleChargeCancel,
      onInputStateChange: updateXRInputState,
    });
    xrSessionManager = new XRSessionManager({
      renderer: renderContext.renderer,
      onStateChange: updateXRState,
    });
    xrPerformanceMonitor = new XRPerformanceMonitor({
      renderer: renderContext.renderer,
      onUpdate: updateXRDiagnostics,
    });
    gameApp = new GameApp({
      renderContext,
      lookController,
      fireController,
      xrController: xrSlingshotController,
      performanceMonitor: xrPerformanceMonitor,
      gameSession,
    });
    gameApp.start();
    void xrSessionManager.checkSupport();
  } catch (error) {
    if (gameApp) {
      gameApp.dispose();
    } else {
      xrSlingshotController?.dispose();
      xrPerformanceMonitor?.dispose();
      fireController?.dispose();
      gameSession?.dispose();
      lookController?.dispose();
      renderContext?.dispose();
    }
    gameApp = null;
    fireController = null;
    gameSession = null;
    lookController = null;
    xrSessionManager?.dispose();
    xrSessionManager = null;
    xrSlingshotController = null;
    xrPerformanceMonitor = null;
    xrActive = false;
    activeMatch = null;
    lastCompletedMatch = null;
    sceneContainer.replaceChildren();
    sceneError.hidden = false;
    console.error('Falha ao iniciar a cena Three.js.', error);
  } finally {
    startSceneButton.disabled = false;
    (gameApp && lookController?.isSupported
      ? pointerLockButton
      : exitSceneButton
    ).focus({
      preventScroll: true,
    });
  }
}

function exitPrototype({ focusMenu = true } = {}) {
  closeResultScreen();
  xrSessionManager?.dispose();
  gameApp?.dispose();
  gameApp = null;
  fireController = null;
  gameSession = null;
  lookController = null;
  xrSessionManager = null;
  xrSlingshotController = null;
  xrPerformanceMonitor = null;
  xrActive = false;
  pointerLocked = false;
  activeMatch = null;
  lastCompletedMatch = null;
  prototypeView.dataset.gameState = 'PLAYING';
  prototypeView.dataset.inputMode = 'desktop';
  prototypeView.dataset.xrState = 'checking';
  resetSlingshotHud('idle');
  resetEnemyHud();
  resetPlayerHud();
  resetScoreHud();
  resetItemHud();
  resetXRDiagnostics();
  setShotStatus('idle', 'Ative a mira para preparar o estilingue.');
  sceneContainer.replaceChildren();
  prototypeView.hidden = true;
  landing.hidden = false;
  document.body.classList.remove('scene-active');

  if (focusMenu) {
    startSceneButton.focus({ preventScroll: true });
  }
}

function replayPrototype() {
  exitPrototype({ focusMenu: false });
  enterPrototype();
}

function handleSceneKeyboard(event) {
  if (
    event.key === 'Escape' &&
    !event.repeat &&
    !prototypeView.hidden &&
    !resultScreen.open
  ) {
    if (pointerLocked || lookController?.isLocked) {
      if (!lookController?.unlock()) {
        updateLookState({
          locked: false,
          supported: lookController?.isSupported ?? false,
        });
      }

      return;
    }

    exitPrototype();
  }
}

function requestPointerLock() {
  if (!lookController || gameSession?.isTerminal || xrActive) {
    return;
  }

  pointerLockStatus.textContent = 'Solicitando captura do ponteiro…';
  pointerLockButton.disabled = true;
  pointerLockButton.setAttribute('aria-busy', 'true');

  if (!lookController.requestLock()) {
    pointerLockButton.disabled = !lookController.isSupported;
    pointerLockButton.removeAttribute('aria-busy');
  }
}

function handleResultCancel(event) {
  event.preventDefault();
  exitPrototype();
}

function retryResultSubmission() {
  void submitCompletedMatch(lastCompletedMatch);
}

startSceneButton.addEventListener('click', enterPrototype);
exitSceneButton.addEventListener('click', exitPrototype);
pointerLockButton.addEventListener('click', requestPointerLock);
xrButton.addEventListener('click', toggleXRSession);
replayButton.addEventListener('click', replayPrototype);
resultMenuButton.addEventListener('click', exitPrototype);
resultRetryButton.addEventListener('click', retryResultSubmission);
resultScreen.addEventListener('cancel', handleResultCancel);
document.addEventListener('keydown', handleSceneKeyboard);
rankingRefreshButton.addEventListener('click', loadRanking);

apiButton.addEventListener('click', async () => {
  apiButton.disabled = true;
  apiStatus.dataset.state = 'loading';
  apiStatus.textContent = 'Consultando a API…';

  try {
    const response = await fetch('/api/health', {
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    const description = describeApiHealth(response.status, data);

    if (!description) {
      throw new Error('A API respondeu com indisponibilidade.');
    }

    apiStatus.dataset.state = description.state;
    apiStatus.textContent = description.message;
  } catch {
    apiStatus.dataset.state = 'error';
    apiStatus.textContent = 'API indisponível. Inicie o projeto com “npm run dev” e tente novamente.';
  } finally {
    apiButton.disabled = false;
  }
});

void loadRanking();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    gameApp?.dispose();
    startSceneButton.removeEventListener('click', enterPrototype);
    exitSceneButton.removeEventListener('click', exitPrototype);
    pointerLockButton.removeEventListener('click', requestPointerLock);
    xrButton.removeEventListener('click', toggleXRSession);
    replayButton.removeEventListener('click', replayPrototype);
    resultMenuButton.removeEventListener('click', exitPrototype);
    resultRetryButton.removeEventListener('click', retryResultSubmission);
    resultScreen.removeEventListener('cancel', handleResultCancel);
    document.removeEventListener('keydown', handleSceneKeyboard);
    rankingRefreshButton.removeEventListener('click', loadRanking);
  });
}
