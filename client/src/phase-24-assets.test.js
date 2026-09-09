import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

import { FINAL_TEXTURE_MANIFEST } from './assets/final-assets.js';
import { SOUND_RECIPES } from './audio/GameAudioSystem.js';

const [indexHtml, mainSource, enemySource, impactSource] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('./main.js', import.meta.url), 'utf8'),
  readFile(new URL('./gameplay/EnemySystem.js', import.meta.url), 'utf8'),
  readFile(new URL('./gameplay/ImpactFeedbackSystem.js', import.meta.url), 'utf8'),
]);

test('mantém no pacote as três texturas finais compactas', async () => {
  assert.deepEqual(Object.keys(FINAL_TEXTURE_MANIFEST), ['snow', 'ice', 'rock']);

  for (const descriptor of Object.values(FINAL_TEXTURE_MANIFEST)) {
    const assetUrl = new URL(`../public${descriptor.url}`, import.meta.url);
    const [metadata, bytes] = await Promise.all([
      stat(assetUrl),
      readFile(assetUrl),
    ]);

    assert.ok(metadata.size > 4_096);
    assert.ok(metadata.size < 128 * 1_024);
    assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xd8]);
  }
});

test('liga a identidade sonora aos eventos principais do gameplay', () => {
  assert.deepEqual(Object.keys(SOUND_RECIPES), [
    'charge',
    'shot',
    'hit',
    'enemy-defeat',
    'player-damage',
    'item',
    'victory',
    'defeat',
  ]);
  assert.match(mainSource, /new GameAudioSystem\(\)/);

  for (const sound of [
    'charge',
    'shot',
    'hit',
    'enemy-defeat',
    'player-damage',
    'item',
  ]) {
    assert.match(mainSource, new RegExp(`play\\('${sound}'\\)`));
  }
  assert.match(
    mainSource,
    /play\(state\.result === 'victory' \? 'victory' : 'defeat'\)/,
  );
});

test('identifica classes por modelo, anima impacto e usa partículas', () => {
  assert.match(enemySource, /ice-enemy-medium-crystals/);
  assert.match(enemySource, /ice-enemy-resistant-armor/);
  assert.match(enemySource, /ice-enemy-boss-crown/);
  assert.match(enemySource, /hitPulseRemainingSeconds/);
  assert.match(impactSource, /new Points\(/);
  assert.match(impactSource, /createImpactParticlePositions/);
});

test('preserva os assets da fase 24 após sua aprovação', () => {
  assert.match(indexHtml, /Fase 25 em validação/);
  assert.doesNotMatch(indexHtml, /Fase 24 em validação/);
});
