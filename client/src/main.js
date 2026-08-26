import { describeApiHealth } from './api-health.js';
import { PROJECT_INFO } from './project-info.js';
import './styles.css';

const teamList = document.querySelector('#team-list');
const apiButton = document.querySelector('#api-status-button');
const apiStatus = document.querySelector('#api-status');
const projectVersion = document.querySelector('#project-version');

for (const member of PROJECT_INFO.team) {
  const item = document.createElement('li');
  item.textContent = member;
  teamList.append(item);
}

projectVersion.textContent = `${PROJECT_INFO.name} · v${PROJECT_INFO.version}`;

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
