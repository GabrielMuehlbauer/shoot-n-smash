import { describeApiHealth } from './api-health.js';
import { GameApp } from './core/GameApp.js';
import { RenderContext } from './core/RenderContext.js';
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

let gameApp = null;

for (const member of PROJECT_INFO.team) {
  const item = document.createElement('li');
  item.textContent = member;
  teamList.append(item);
}

projectVersion.textContent = `${PROJECT_INFO.name} · v${PROJECT_INFO.version}`;

function enterPrototype() {
  let renderContext = null;

  startSceneButton.disabled = true;
  landing.hidden = true;
  prototypeView.hidden = false;
  sceneError.hidden = true;
  document.body.classList.add('scene-active');

  try {
    renderContext = new RenderContext(sceneContainer);
    gameApp = new GameApp({ renderContext });
    gameApp.start();
  } catch (error) {
    if (gameApp) {
      gameApp.dispose();
    } else {
      renderContext?.dispose();
    }
    gameApp = null;
    sceneContainer.replaceChildren();
    sceneError.hidden = false;
    console.error('Falha ao iniciar a cena Three.js.', error);
  } finally {
    startSceneButton.disabled = false;
    exitSceneButton.focus({ preventScroll: true });
  }
}

function exitPrototype() {
  gameApp?.dispose();
  gameApp = null;
  sceneContainer.replaceChildren();
  prototypeView.hidden = true;
  landing.hidden = false;
  document.body.classList.remove('scene-active');
  startSceneButton.focus({ preventScroll: true });
}

function handleSceneKeyboard(event) {
  if (event.key === 'Escape' && !prototypeView.hidden) {
    exitPrototype();
  }
}

startSceneButton.addEventListener('click', enterPrototype);
exitSceneButton.addEventListener('click', exitPrototype);
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
    document.removeEventListener('keydown', handleSceneKeyboard);
  });
}
