import assert from 'node:assert/strict';
import test from 'node:test';

import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

import {
  createGolemAssetCache,
  disposeGolemAsset,
} from './GolemAssetCache.js';

test('reutiliza o GLB preparado e cria instâncias leves com materiais isolados', async () => {
  const template = new Group();
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();
  template.add(new Mesh(geometry, material));
  let loadCount = 0;
  let geometryDisposeCount = 0;
  geometry.addEventListener('dispose', () => {
    geometryDisposeCount += 1;
  });
  const cache = createGolemAssetCache({
    url: '/model.glb',
    prepare: (scene) => scene,
  });
  const loader = {
    async loadAsync() {
      loadCount += 1;
      return { scene: template };
    },
  };

  const [first, second] = await Promise.all([
    cache.load(loader),
    cache.load(loader),
  ]);
  const third = cache.create();

  assert.equal(loadCount, 1);
  assert.notEqual(first, second);
  assert.ok(third);
  assert.equal(first.children[0].geometry, second.children[0].geometry);
  assert.notEqual(first.children[0].material, second.children[0].material);

  disposeGolemAsset(first);
  assert.equal(geometryDisposeCount, 0);
  disposeGolemAsset(template);
  assert.equal(geometryDisposeCount, 1);
});
