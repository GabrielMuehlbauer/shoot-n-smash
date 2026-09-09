import { MirroredRepeatWrapping, SRGBColorSpace } from 'three';

export const FINAL_TEXTURE_MANIFEST = Object.freeze({
  snow: Object.freeze({
    url: '/assets/textures/snow-ground.jpg',
    repeat: 10,
  }),
  ice: Object.freeze({
    url: '/assets/textures/glacier-ice.jpg',
    repeat: 5,
  }),
  rock: Object.freeze({
    url: '/assets/textures/arctic-rock.jpg',
    repeat: 4,
  }),
});

export async function loadFinalTextureSet({
  textureLoader,
  maximumAnisotropy = 1,
  manifest = FINAL_TEXTURE_MANIFEST,
} = {}) {
  if (typeof textureLoader?.loadAsync !== 'function') {
    throw new TypeError('O carregamento de assets requer um TextureLoader.');
  }

  const anisotropy = Math.max(
    1,
    Math.min(4, Math.floor(Number(maximumAnisotropy) || 1)),
  );
  const entries = Object.entries(manifest);

  if (entries.length === 0) {
    throw new TypeError('O manifesto de texturas finais não pode estar vazio.');
  }

  const results = await Promise.allSettled(
    entries.map(async ([name, descriptor]) => {
      if (
        typeof descriptor?.url !== 'string' ||
        descriptor.url.trim() === '' ||
        !Number.isFinite(descriptor.repeat) ||
        descriptor.repeat <= 0
      ) {
        throw new TypeError(`O asset ${name} possui descrição inválida.`);
      }

      const texture = await textureLoader.loadAsync(descriptor.url);
      texture.name = `final-texture-${name}`;
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = MirroredRepeatWrapping;
      texture.wrapT = MirroredRepeatWrapping;
      texture.repeat.set(descriptor.repeat, descriptor.repeat);
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
      return [name, texture];
    }),
  );

  const rejected = results.find((result) => result.status === 'rejected');
  if (rejected) {
    for (const result of results) {
      if (result.status === 'fulfilled') {
        result.value[1].dispose?.();
      }
    }
    throw rejected.reason;
  }

  const loadedEntries = results.map((result) => result.value);

  return Object.freeze(Object.fromEntries(loadedEntries));
}
