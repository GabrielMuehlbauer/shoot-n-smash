import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('./main.js', import.meta.url), 'utf8');
const stylesCss = fs.readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

test('exibe ranking global acessível com atualização manual', () => {
  assert.match(indexHtml, /id="ranking-title">Ranking global/);
  assert.match(indexHtml, /<table class="ranking-table">[\s\S]*id="ranking-body"/);
  assert.match(indexHtml, /id="ranking-status"[\s\S]*role="status"[\s\S]*aria-live="polite"/);
  assert.match(indexHtml, /id="ranking-refresh-button"/);
  assert.match(mainSource, /matchApi\.getRanking\(\{ scenario: 'neve', limit: 10 \}\)/);
  assert.match(mainSource, /rankingBody\.replaceChildren\(fragment\)/);
  assert.match(mainSource, /cell\.textContent = value/);
  assert.match(stylesCss, /\.ranking-table-wrap\s*\{[\s\S]*overflow-x: auto/);
});

test('registra uma única identidade por partida terminal e permite retry', () => {
  assert.match(mainSource, /submissionId: createSubmissionId\(\)/);
  assert.match(mainSource, /startedAt: performance\.now\(\)/);
  assert.match(mainSource, /const completedMatch = completeActiveMatch\(state\)/);
  assert.match(mainSource, /void submitCompletedMatch\(completedMatch\)/);
  assert.match(mainSource, /savingSubmissionIds\.has\(match\.submissionId\)/);
  assert.match(mainSource, /resultRetryButton\.addEventListener\('click', retryResultSubmission\)/);
});

test('mostra duração e estado de persistência sem bloquear replay', () => {
  for (const id of [
    'result-duration',
    'result-sync-status',
    'result-retry-button',
    'replay-button',
  ]) {
    assert.match(indexHtml, new RegExp(`id="${id}"`));
  }

  assert.match(mainSource, /formatMatchDuration\(match\.duracaoMs\)/);
  assert.match(mainSource, /Partida registrada no ranking global/);
  assert.match(stylesCss, /\.result-sync\[data-state='error'\]/);
});
