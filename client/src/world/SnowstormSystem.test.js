import assert from 'node:assert/strict';
import test from 'node:test';

import { PerspectiveCamera, Scene } from 'three';

import { SNOW_ARENA_CONFIG } from '../config/snow-arena-config.js';
import {
  resolveWeatherProfile,
  SnowstormSystem,
} from './SnowstormSystem.js';

test('a intensidade cresce por onda e culmina em nevasca no chefÃ£o', () => {
  const profiles = [1, 2, 3, 4].map((wave) =>
    resolveWeatherProfile({ wave, status: 'active' }),
  );
  const boss = resolveWeatherProfile({ wave: 4, status: 'boss' });

  for (let index = 1; index < profiles.length; index += 1) {
    assert.ok(profiles[index].intensity > profiles[index - 1].intensity);
    assert.ok(profiles[index].fogFar < profiles[index - 1].fogFar);
  }
  assert.ok(boss.intensity > profiles.at(-1).intensity);
  assert.ok(boss.fogFar < profiles.at(-1).fogFar);
  assert.equal(
    resolveWeatherProfile({ wave: 4, status: 'boss-pending' }),
    boss,
  );
});

test('transiciona suavemente, move a neve e mantÃ©m a visibilidade de combate', () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  camera.position.set(3, 1.65, -2);
  const weather = new SnowstormSystem({ scene, camera });
  const initialIntensity = weather.current.intensity;
  const initialY = weather.positionAttribute.getY(0);

  weather.setWaveState({ wave: 4, status: 'boss' });
  weather.update(SNOW_ARENA_CONFIG.weather.transitionSeconds / 2);

  assert.ok(weather.current.intensity > initialIntensity);
  assert.ok(weather.current.intensity < weather.target.intensity);
  assert.ok(weather.positionAttribute.getY(0) < initialY);
  assert.equal(weather.points.position.x, camera.position.x);
  assert.equal(weather.points.position.z, camera.position.z);
  assert.ok(scene.fog.near >= 13);
  assert.ok(scene.fog.far >= 68);
  assert.ok(scene.fog.far > scene.fog.near);
  assert.ok(weather.geometry.drawRange.count < weather.config.maxParticleCount);

  weather.update(SNOW_ARENA_CONFIG.weather.transitionSeconds * 10);
  assert.equal(weather.current.intensity, weather.target.intensity);
  assert.equal(weather.geometry.drawRange.count, Math.round(
    weather.config.maxParticleCount * weather.target.intensity,
  ));
  assert.equal(weather.dispose(), true);
  assert.equal(weather.dispose(), false);
  assert.equal(scene.getObjectByName('progressive-snowstorm'), undefined);
});
