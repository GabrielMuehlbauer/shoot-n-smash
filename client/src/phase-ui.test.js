import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [indexHtml, mainSource, stylesCss] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('./main.js', import.meta.url), 'utf8'),
  readFile(new URL('./styles.css', import.meta.url), 'utf8'),
]);

test('marca a interface estática como Fase 10 e prepara os HUDs', () => {
  assert.match(indexHtml, /Fase 10 concluída/);
  assert.match(indexHtml, /data-player-state="healthy"/);
  assert.match(indexHtml, /id="player-health-label">Vida do jogador/);
  assert.match(indexHtml, /id="player-health-value"[^>]*>100 \/ 100/);
  assert.match(indexHtml, /id="player-health"[^>]*class="player-health"/);
  assert.match(indexHtml, /aria-valuemax="100"/);
  assert.match(indexHtml, /aria-valuenow="100"/);
  assert.match(indexHtml, /data-enemy-type="weak"/);
  assert.match(indexHtml, /id="enemy-resistance-label">Inimigo fraco/);
  assert.match(indexHtml, /aria-describedby="enemy-status"/);
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
