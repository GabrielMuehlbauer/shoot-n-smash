import { describeApiHealth } from './api-health.js';
import { GAMEPLAY_CONFIG } from './config/gameplay-config.js';
import { GameApp } from './core/GameApp.js';
import { GameSession } from './core/GameSession.js';
import { RenderContext } from './core/RenderContext.js';
import { describeEnemyState } from './enemy-hud.js';
import { DesktopFireController } from './input/DesktopFireController.js';
import { DesktopLookController } from './input/DesktopLookController.js';
import { describePlayerHealth } from './player-hud.js';
import { PROJECT_INFO } from './project-info.js';
import './styles.css';

const teamList = document.querySelector('#team-list');
const apiButton = document.querySelector('#api-status-button');
const apiStatus = document.querySelector('#api-status');
const projectVersion = document.querySelector('#project-version');
const landing = document.querySelector('[data-landing]');
const startSceneButton = document.querySelector('#start-scene-button');
const prototypeView = document.querySelector('#prototype-view');
const sceneContainer = document.querySelector('#scene-container');
const sceneError = document.querySelector('#scene-error');
const exitSceneButton = document.querySelector('#exit-scene-button');
const pointerLockButton = document.querySelector('#pointer-lock-button');
const pointerLockStatus = document.querySelector('#pointer-lock-status');
const slingshotHud = document.querySelector('#slingshot-hud');
const slingshotTension = document.querySelector('#slingshot-tension');
const slingshotTensionValue = document.querySelector(
  '#slingshot-tension-value',
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
const waveProgress = document.querySelector('#wave-progress');
const playerHud = document.querySelector('#player-hud');
const playerHealth = document.querySelector('#player-health');
const playerHealthValue = document.querySelector('#player-health-value');
const playerStatus = document.querySelector('#player-status');

let gameApp = null;
let lookController = null;
let fireController = null;
let gameSession = null;
let pointerLocked = false;
let announcedChargeStage = -1;

for (const member of PROJECT_INFO.team) {
  const item = document.createElement('li');
  item.textContent = member;
  teamList.append(item);
}

projectVersion.textContent = `${PROJECT_INFO.name} · v${PROJECT_INFO.version}`;

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

function showEncounterOutcome(outcome = gameSession?.enemyState?.outcome) {
  const waveState = gameSession?.waveState;

  if (outcome === 'eliminated' && waveState) {
    const nextMessage =
      waveState.status === 'complete'
        ? 'As quatro ondas foram concluídas.'
        : waveState.status === 'between-waves'
          ? `Onda ${waveState.wave} de ${waveState.totalWaves} em instantes.`
          : `Inimigo ${waveState.enemy} de ${waveState.enemiesInWave} em instantes.`;

    setShotStatus(
      'ready',
      `Inimigo eliminado. ${nextMessage}`,
    );
    return true;
  }

  if (outcome === 'player-contact' && waveState) {
    const { health, maxHealth } = gameSession.playerState;
    const { damage, label } = gameSession.enemyState.type;
    const nextMessage =
      waveState.status === 'complete'
        ? 'As quatro ondas foram concluídas.'
        : waveState.status === 'between-waves'
          ? `Onda ${waveState.wave} de ${waveState.totalWaves} em instantes.`
          : `Inimigo ${waveState.enemy} de ${waveState.enemiesInWave} em instantes.`;

    setShotStatus(
      'idle',
      `O inimigo ${label.toLocaleLowerCase('pt-BR')} causou ${damage} de dano. Vida: ${health} / ${maxHealth}. ${nextMessage}`,
    );
    return true;
  }

  return false;
}

function updateWaveState(state) {
  prototypeView.dataset.waveState = state.status;
  waveProgress.textContent = `Onda ${state.wave} de ${state.totalWaves} · Inimigo ${state.enemy} de ${state.enemiesInWave}`;

  if (state.status === 'active') {
    updateEnemyState(gameSession.enemyState);
    setShotStatus(
      pointerLocked ? 'ready' : 'idle',
      `Onda ${state.wave}. Inimigo ${state.enemy} de ${state.enemiesInWave}: localize-o em 360°.`,
    );
    return;
  }

  showEncounterOutcome();
}

function updateChargeState({ charging, ratio }) {
  const normalizedRatio = Math.min(Math.max(Number(ratio) || 0, 0), 1);
  const percent = Math.round(normalizedRatio * 100);

  slingshotTension.value = percent;
  slingshotTension.textContent = `${percent}%`;
  slingshotTension.setAttribute(
    'aria-valuetext',
    `${percent}% de tensão`,
  );
  slingshotTensionValue.textContent = `${percent}%`;

  if (!charging) {
    resetSlingshotHud(pointerLocked ? 'ready' : 'idle');
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

  if (showEncounterOutcome()) {
    return;
  }

  setShotStatus(
    'ready',
    `Disparo de ${percent}% lançado · ${projectileLabel}.`,
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
  resetSlingshotHud('idle');

  const messages = {
    'document-hidden': 'Carga cancelada porque a página ficou oculta.',
    'pointer-lock-lost': 'Carga cancelada. Ative a mira para tentar novamente.',
    'window-blur': 'Carga cancelada porque a janela perdeu o foco.',
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

  if (!locked && supported && !prototypeView.hidden) {
    pointerLockButton.focus({ preventScroll: true });
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
  landing.hidden = true;
  prototypeView.hidden = false;
  sceneError.hidden = true;
  document.body.classList.add('scene-active');
  resetEnemyHud();
  resetPlayerHud();

  try {
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
      onWaveChange: updateWaveState,
      onPlayerHealthChange: updatePlayerState,
      onShot: handleShot,
    });
    updateEnemyState(gameSession.enemyState);
    updateWaveState(gameSession.waveState);
    updatePlayerState(gameSession.playerState);
    fireController = new DesktopFireController({
      canvas: renderContext.renderer.domElement,
      onChargeStart: () => gameSession.beginCharge(),
      onChargeRelease: () => gameSession.releaseShot(),
      onChargeCancel: handleChargeCancel,
    });
    gameApp = new GameApp({
      renderContext,
      lookController,
      fireController,
      gameSession,
    });
    gameApp.start();
  } catch (error) {
    if (gameApp) {
      gameApp.dispose();
    } else {
      fireController?.dispose();
      gameSession?.dispose();
      lookController?.dispose();
      renderContext?.dispose();
    }
    gameApp = null;
    fireController = null;
    gameSession = null;
    lookController = null;
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

function exitPrototype() {
  gameApp?.dispose();
  gameApp = null;
  fireController = null;
  gameSession = null;
  lookController = null;
  pointerLocked = false;
  resetSlingshotHud('idle');
  resetEnemyHud();
  resetPlayerHud();
  setShotStatus('idle', 'Ative a mira para preparar o estilingue.');
  sceneContainer.replaceChildren();
  prototypeView.hidden = true;
  landing.hidden = false;
  document.body.classList.remove('scene-active');
  startSceneButton.focus({ preventScroll: true });
}

function handleSceneKeyboard(event) {
  if (
    event.key === 'Escape' &&
    !event.repeat &&
    !prototypeView.hidden
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
  if (!lookController) {
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

startSceneButton.addEventListener('click', enterPrototype);
exitSceneButton.addEventListener('click', exitPrototype);
pointerLockButton.addEventListener('click', requestPointerLock);
document.addEventListener('keydown', handleSceneKeyboard);

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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    gameApp?.dispose();
    startSceneButton.removeEventListener('click', enterPrototype);
    exitSceneButton.removeEventListener('click', exitPrototype);
    pointerLockButton.removeEventListener('click', requestPointerLock);
    document.removeEventListener('keydown', handleSceneKeyboard);
  });
}
