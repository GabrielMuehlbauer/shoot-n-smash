import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateViewport,
  resizeRendererToContainer,
} from './viewport.js';

test('calcula aspecto e limita o pixel ratio do renderer', () => {
  assert.deepEqual(calculateViewport(1280, 720, 3, 2), {
    width: 1280,
    height: 720,
    aspect: 16 / 9,
    pixelRatio: 2,
  });
});

test('evita dimensões zero, negativas ou inválidas', () => {
  assert.deepEqual(calculateViewport(0, Number.NaN, 0, 2), {
    width: 1,
    height: 1,
    aspect: 1,
    pixelRatio: 1,
  });
});

test('atualiza câmera e renderer com as dimensões do contêiner', () => {
  const calls = [];
  const camera = {
    aspect: 0,
    updateProjectionMatrix: () => calls.push(['projection']),
  };
  const renderer = {
    setPixelRatio: (value) => calls.push(['pixelRatio', value]),
    setSize: (...values) => calls.push(['size', ...values]),
  };
  const container = {
    getBoundingClientRect: () => ({ width: 900.9, height: 600.8 }),
  };

  const viewport = resizeRendererToContainer({
    container,
    camera,
    renderer,
    devicePixelRatio: 2.5,
    maxPixelRatio: 2,
  });

  assert.equal(camera.aspect, 1.5);
  assert.deepEqual(viewport, {
    width: 900,
    height: 600,
    aspect: 1.5,
    pixelRatio: 2,
  });
  assert.deepEqual(calls, [
    ['projection'],
    ['pixelRatio', 2],
    ['size', 900, 600, false],
  ]);
});
