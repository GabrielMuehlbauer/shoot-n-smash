import assert from 'node:assert/strict';
import test from 'node:test';

import { MirroredRepeatWrapping, SRGBColorSpace, Texture } from 'three';

import {
  FINAL_TEXTURE_MANIFEST,
  loadFinalTextureSet,
} from './final-assets.js';

test('carrega e configura o conjunto compacto de texturas finais', async () => {
  const urls = [];
  const textureLoader = {
    async loadAsync(url) {
      urls.push(url);
      return new Texture();
    },
  };

  const textures = await loadFinalTextureSet({
    textureLoader,
    maximumAnisotropy: 16,
  });

  assert.deepEqual(urls, Object.values(FINAL_TEXTURE_MANIFEST).map(({ url }) => url));
  assert.deepEqual(Object.keys(textures), ['snow', 'ice', 'rock']);
  for (const [name, texture] of Object.entries(textures)) {
    assert.equal(texture.name, `final-texture-${name}`);
    assert.equal(texture.colorSpace, SRGBColorSpace);
    assert.equal(texture.wrapS, MirroredRepeatWrapping);
    assert.equal(texture.wrapT, MirroredRepeatWrapping);
    assert.equal(texture.anisotropy, 4);
    assert.equal(texture.repeat.x, FINAL_TEXTURE_MANIFEST[name].repeat);
  }
});

test('libera carregamentos parciais quando um asset falha', async () => {
  let disposeCalls = 0;
  const textureLoader = {
    async loadAsync(url) {
      if (url.includes('glacier')) {
        throw new Error('falha simulada');
      }
      const texture = new Texture();
      texture.dispose = () => {
        disposeCalls += 1;
      };
      return texture;
    },
  };

  await assert.rejects(
    () => loadFinalTextureSet({ textureLoader }),
    /falha simulada/,
  );
  assert.equal(disposeCalls, 2);
  await assert.rejects(() => loadFinalTextureSet(), /TextureLoader/i);
});
