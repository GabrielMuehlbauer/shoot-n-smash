import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('./main.js', import.meta.url), 'utf8');
const stylesCss = fs.readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

test('apresenta força e previsão de trajetória no HUD do estilingue', () => {
  assert.match(indexHtml, /id="slingshot-speed-value"[^>]*>10,0 u\/s/);
  assert.match(indexHtml, /id="slingshot-trajectory-value"[^>]*>Segure para prever/);
  assert.match(mainSource, /function updateChargeState\(\{ charging, ratio, speed, ammoType/);
  assert.match(mainSource, /slingshotSpeedValue\.textContent/);
  assert.match(mainSource, /Dourada prevista/);
  assert.match(stylesCss, /\.shot-telemetry\s*\{[\s\S]*grid-template-columns/);
});

test('mantém telemetria compacta sem remover os controles existentes', () => {
  assert.match(indexHtml, /id="slingshot-tension"/);
  assert.match(indexHtml, /id="pointer-lock-button"/);
  assert.match(indexHtml, /id="replay-button"/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*12\.3rem/);
  assert.match(stylesCss, /@media \(max-width: 420px\), \(max-height: 650px\)[\s\S]*11\.2rem/);
});
