import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('./main.js', import.meta.url), 'utf8');
const stylesCss = fs.readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

test('apresenta as métricas necessárias para o ensaio no Quest 3', () => {
  for (const id of [
    'xr-diagnostics',
    'xr-diagnostics-fps',
    'xr-diagnostics-frame',
    'xr-diagnostics-draw-calls',
    'xr-diagnostics-triangles',
    'xr-diagnostics-memory',
    'xr-diagnostics-controllers',
  ]) {
    assert.match(indexHtml, new RegExp(`id="${id}"`));
  }

  assert.match(mainSource, /new XRPerformanceMonitor/);
  assert.match(mainSource, /new XRHudSystem/);
  assert.match(mainSource, /xrPerformanceMonitor\?\.start/);
  assert.match(mainSource, /xrPerformanceMonitor\?\.stop/);
  assert.match(mainSource, /xrHudSystem\?\.setActive\(nextActive\)/);
  assert.match(mainSource, /xrHudSystem\?\.setPlayerState\(state\)/);
  assert.match(mainSource, /xrHudSystem\?\.setEnemyState\(state\)/);
  assert.match(mainSource, /xrHudSystem\?\.setWaveState\(state\)/);
  assert.match(mainSource, /xrSlingshotController\?\.setChargeState/);
  assert.match(stylesCss, /\.xr-diagnostics\[data-state='complete'\]/);
  assert.match(stylesCss, /\.xr-diagnostics\[hidden\]/);
});

test('preserva as métricas da fase 23 após a aprovação no dispositivo real', () => {
  assert.match(indexHtml, /Fase 25 em validação/);
  assert.doesNotMatch(indexHtml, /Fase 23 em validação/);
});
