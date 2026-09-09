import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [indexHtml, mainSource, stylesCss] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('./main.js', import.meta.url), 'utf8'),
  readFile(new URL('./styles.css', import.meta.url), 'utf8'),
]);

test('marca a interface estática como Fase 25 em validação e preserva o HUD consolidado', () => {
  assert.match(indexHtml, /Fase 25 em validação/);
  assert.match(indexHtml, /class="status-hud"/);
  assert.match(indexHtml, /id="score-label">Pontuação/);
  assert.match(indexHtml, /id="score-value"[^>]*>0/);
  assert.match(indexHtml, /data-score-event="initial"/);
  assert.match(indexHtml, /data-player-state="healthy"/);
  assert.match(indexHtml, /id="player-health-label">Vida do jogador/);
  assert.match(indexHtml, /id="player-health-value"[^>]*>100 \/ 100/);
  assert.match(indexHtml, /id="player-health"[^>]*class="player-health"/);
  assert.match(indexHtml, /aria-valuemax="100"/);
  assert.match(indexHtml, /aria-valuenow="100"/);
  assert.match(indexHtml, /data-enemy-type="weak"/);
  assert.match(indexHtml, /id="enemy-resistance-label">Inimigo fraco/);
  assert.match(indexHtml, /aria-describedby="enemy-status"/);
  assert.match(indexHtml, /id="wave-label"[^>]*>Onda 1 de 4/);
  assert.match(indexHtml, /id="wave-progress"[^>]*>Inimigo 1 de 3/);
  assert.match(indexHtml, /id="wave-meter"[\s\S]*max="5"[\s\S]*value="1"/);
  assert.match(indexHtml, /id="item-hud"/);
  assert.match(indexHtml, /id="special-ammo-value"/);
});

test('conecta itens coletáveis e munição especial ao HUD acessível', () => {
  assert.match(mainSource, /onItemCollected:\s*handleItemCollected/);
  assert.match(mainSource, /onItemStateChange:\s*updateItemState/);
  assert.match(mainSource, /onSpecialAmmoChange:\s*updateSpecialAmmoState/);
  assert.match(
    indexHtml,
    /id="item-status"[^>]*role="status"[^>]*aria-live="polite"/,
  );
  assert.match(stylesCss, /\.item-hud\[data-item-state='available'\]/);
  assert.match(stylesCss, /data-special-ammo='active'/);
});

test('mantém eventos do inimigo visíveis sem duplicar o live region de disparo', () => {
  const enemyStatusTag = indexHtml.match(
    /<p\s+id="enemy-status"(?<attributes>[^>]*)>/,
  );

  assert.ok(enemyStatusTag);
  assert.doesNotMatch(enemyStatusTag.groups.attributes, /role="status"/);
  assert.doesNotMatch(enemyStatusTag.groups.attributes, /aria-live=/);
  assert.match(
    indexHtml,
    /id="shot-status"[^>]*role="status"[^>]*aria-live="polite"/,
  );
});

test('associa a barra de vida ao rótulo e ao feedback visual', () => {
  const playerHealthTag = indexHtml.match(
    /<div\s+id="player-health"(?<attributes>[^>]*)>/,
  );

  assert.ok(playerHealthTag);
  assert.match(playerHealthTag.groups.attributes, /role="progressbar"/);
  assert.match(
    playerHealthTag.groups.attributes,
    /aria-labelledby="player-health-label"/,
  );
  assert.match(
    playerHealthTag.groups.attributes,
    /aria-describedby="player-status"/,
  );
});

test('conecta mudanças de vida aos estados visuais do HUD', () => {
  assert.match(
    mainSource,
    /playerHud\.dataset\.playerState = description\.hudState/,
  );
  assert.match(
    mainSource,
    /onPlayerHealthChange:\s*updatePlayerState/,
  );
  assert.match(
    stylesCss,
    /\.player-hud\[data-player-state='damaged'\]/,
  );
  assert.match(
    stylesCss,
    /\.player-hud\[data-player-state='depleted'\]/,
  );
  assert.match(stylesCss, /@keyframes player-damage-pulse/);
});

test('conecta o progresso das ondas ao respawn e ao HUD', () => {
  assert.match(mainSource, /onWaveChange:\s*updateWaveState/);
  assert.match(mainSource, /describeWaveState\(state/);
  assert.match(mainSource, /waveLabel\.textContent = description\.label/);
  assert.match(mainSource, /waveProgress\.textContent = description\.detail/);
  assert.match(mainSource, /waveMeter\.value = description\.stageValue/);
  assert.match(mainSource, /aria-label', description\.ariaLabel/);
  assert.match(stylesCss, /\.wave-progress/);
  assert.match(mainSource, /state\.status === 'boss-pending'/);
  assert.match(mainSource, /state\.status === 'boss'/);
  assert.match(stylesCss, /data-enemy-type='boss'/);
});

test('evita sobreposição dos painéis em desktop e telas pequenas', () => {
  assert.match(stylesCss, /\.status-hud\s*\{[\s\S]*grid-template-columns/);
  assert.match(
    stylesCss,
    /@media \(max-width: 760px\)[\s\S]*\.status-hud\s*\{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    stylesCss,
    /@media \(max-width: 760px\)[\s\S]*\.scene-caption\s*\{\s*display: none/,
  );
  assert.doesNotMatch(stylesCss, /\.player-hud\s*\{[\s\S]{0,120}position: absolute/);
  assert.doesNotMatch(stylesCss, /\.enemy-hud\s*\{[\s\S]{0,120}position: absolute/);
});

test('conecta o ScoreManager ao placar visivel', () => {
  assert.match(mainSource, /onScoreChange:\s*updateScoreState/);
  assert.match(mainSource, /scoreValue\.textContent = description\.valueText/);
  assert.match(stylesCss, /\.score-hud/);
  assert.match(stylesCss, /#score-value/);
});

test('prepara nome e tela final acessivel com todos os dados obrigatorios', () => {
  assert.match(
    indexHtml,
    /id="player-name-input"[\s\S]*maxlength="24"[\s\S]*autocomplete="nickname"/,
  );
  assert.match(
    indexHtml,
    /<dialog[\s\S]*id="result-screen"[\s\S]*aria-labelledby="result-title"[\s\S]*aria-describedby="result-message"/,
  );

  for (const id of [
    'result-player-name',
    'result-outcome',
    'result-score',
    'result-scenario',
    'replay-button',
    'result-menu-button',
  ]) {
    assert.match(indexHtml, new RegExp(`id="${id}"`));
  }

  assert.match(stylesCss, /\.result-screen\[open\]/);
  assert.match(stylesCss, /\.result-screen\[data-result='defeat'\]/);
  assert.match(stylesCss, /\.result-summary/);
});

test('conecta estado terminal, pausa real e replay com uma sessao nova', () => {
  assert.match(mainSource, /onGameStateChange:\s*handleGameStateChange/);
  assert.match(mainSource, /gameApp\?\.stop\(\)/);
  assert.match(mainSource, /showResultScreen\(state, completedMatch\)/);
  assert.match(mainSource, /replayButton\.focus/);
  assert.match(
    mainSource,
    /function replayPrototype\(\)[\s\S]*exitPrototype\([\s\S]*enterPrototype\(\)/,
  );
  assert.match(mainSource, /resultScreen\.addEventListener\('cancel'/);
});
