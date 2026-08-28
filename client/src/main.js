import { describeApiHealth } from './api-health.js';
import { GameApp } from './core/GameApp.js';
import { GameSession } from './core/GameSession.js';
import { RenderContext } from './core/RenderContext.js';
import { DesktopFireController } from './input/DesktopFireController.js';
import { DesktopLookController } from './input/DesktopLookController.js';
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

  setShotStatus(
    'ready',
    `Disparo de ${percent}% lançado · ${projectileLabel}.`,
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

  setShotStatus('idle', messages[reason] ?? 'Carga cancelada com segurança.');
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
    setShotStatus(
      'ready',
      'Mira ativa. Segure o botão esquerdo para carregar.',
    );
  } else {
    gameSession?.cancelCharge();
    resetSlingshotHud('idle');
    setShotStatus(
      'idle',
      supported
        ? 'Ative a mira para preparar o estilingue.'
        : 'Disparo indisponível sem suporte a Pointer Lock.',
    );
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
      onShot: handleShot,
    });
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
