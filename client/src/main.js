import { describeApiHealth } from './api-health.js';
import { GameApp } from './core/GameApp.js';
import { RenderContext } from './core/RenderContext.js';
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

let gameApp = null;
let lookController = null;
let pointerLocked = false;

for (const member of PROJECT_INFO.team) {
  const item = document.createElement('li');
  item.textContent = member;
  teamList.append(item);
}

projectVersion.textContent = `${PROJECT_INFO.name} · v${PROJECT_INFO.version}`;

function updateLookState({ locked, supported }) {
  pointerLocked = locked;
  prototypeView.dataset.lookState = locked
    ? 'locked'
    : supported
      ? 'unlocked'
      : 'unsupported';
  pointerLockButton.hidden = locked;
  pointerLockButton.disabled = !supported;
  pointerLockStatus.textContent = locked
    ? 'Visão 360° ativa. Mova o mouse para olhar; Esc libera o cursor.'
    : supported
      ? 'Cursor livre. Ative a visão 360° para voltar a olhar com o mouse.'
      : 'Pointer Lock não está disponível neste navegador.';

  if (!locked && supported && !prototypeView.hidden) {
    pointerLockButton.focus({ preventScroll: true });
  }
}

function handleLookError({ message }) {
  pointerLocked = false;
  prototypeView.dataset.lookState = 'error';
  pointerLockButton.hidden = false;
  pointerLockButton.disabled = !lookController?.isSupported;
  pointerLockStatus.textContent = message;

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
    gameApp = new GameApp({ renderContext, lookController });
    gameApp.start();
  } catch (error) {
    if (gameApp) {
      gameApp.dispose();
    } else {
      lookController?.dispose();
      renderContext?.dispose();
    }
    gameApp = null;
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
  lookController = null;
  pointerLocked = false;
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
  lookController.requestLock();
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
