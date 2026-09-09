import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('./main.js', import.meta.url), 'utf8');
const stylesCss = fs.readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

test('oferece entrada WebXR somente após a verificação de suporte', () => {
  assert.match(indexHtml, /id="xr-button"[\s\S]*aria-pressed="false"[\s\S]*disabled/);
  assert.match(indexHtml, /id="xr-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(mainSource, /new XRSessionManager/);
  assert.match(mainSource, /xrSessionManager\.checkSupport\(\)/);
  assert.match(mainSource, /state === 'error'/);
});

test('alterna os adaptadores desktop e XR sem trocar a sessão de jogo', () => {
  assert.match(mainSource, /new XRSlingshotController/);
  assert.match(mainSource, /onChargeStart: \(\{ mode \}\) => beginCharge\(mode\)/);
  assert.match(mainSource, /function beginCharge\(mode = 'time'\)[\s\S]*gameSession\?\.beginCharge\(\{ mode \}\)/);
  assert.match(mainSource, /onChargeChange: \(ratio\) => gameSession\.setChargeRatio\(ratio\)/);
  assert.match(mainSource, /onChargeRelease: \(pose\) => gameSession\.releaseShot\(pose\)/);
  assert.match(mainSource, /gameSession\?\.setDesktopSlingshotVisible\(!nextActive\)/);
  assert.match(stylesCss, /data-input-mode='xr'[\s\S]*\.scene-look-control/);
});
