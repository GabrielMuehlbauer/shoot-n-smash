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
    'xr-diagnostics-controllers',
  ]) {
    assert.match(indexHtml, new RegExp(`id="${id}"`));
  }

  assert.match(mainSource, /new XRPerformanceMonitor/);
  assert.match(mainSource, /xrPerformanceMonitor\?\.start/);
  assert.match(mainSource, /xrPerformanceMonitor\?\.stop/);
  assert.match(stylesCss, /\.xr-diagnostics\[data-state='complete'\]/);
  assert.match(stylesCss, /\.xr-diagnostics\[hidden\]/);
});

test('mantém a fase 23 como validação pendente do dispositivo real', () => {
  assert.match(indexHtml, /Fase 22 concluída/);
  assert.doesNotMatch(indexHtml, /Fase 23 concluída/);
});
