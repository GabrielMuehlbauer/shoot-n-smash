import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexHtml = await readFile(
  new URL('../index.html', import.meta.url),
  'utf8',
);

test('marca a interface estática como Fase 9 e prepara o tipo fraco', () => {
  assert.match(indexHtml, /Fase 9 concluída/);
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
