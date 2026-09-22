import assert from 'node:assert/strict';
import test from 'node:test';

import { Scene, Texture, Vector3 } from 'three';

import {
  SENAC_BLIMP_CONFIG,
  SENAC_LOGO_URL,
  SenacBlimpSystem,
} from './SenacBlimpSystem.js';

test('agenda uma única travessia do dirigível durante a primeira onda', () => {
  const scene = new Scene();
  const blimp = new SenacBlimpSystem({ scene, textureLoader: null });

  assert.equal(blimp.root.name, 'senac-easter-egg-blimp');
  assert.equal(blimp.root.visible, false);
  assert.equal(blimp.setWaveState({ status: 'between-enemies', wave: 1 }), false);
  assert.equal(blimp.setWaveState({ status: 'active', wave: 1 }), true);
  assert.equal(blimp.phase, 'scheduled');

  blimp.update(SENAC_BLIMP_CONFIG.delaySeconds - 0.1);
  assert.equal(blimp.root.visible, false);
  blimp.update(0.2);
  assert.equal(blimp.phase, 'flying');
  assert.equal(blimp.root.visible, true);
  assert.ok(
    blimp.root.position.distanceTo(
      new Vector3(
        SENAC_BLIMP_CONFIG.start.x,
        SENAC_BLIMP_CONFIG.start.y,
        SENAC_BLIMP_CONFIG.start.z,
      ),
    ) > 0,
  );
  assert.ok(blimp.root.getObjectByName('senac-blimp-logo-near'));
  assert.ok(blimp.root.getObjectByName('senac-blimp-logo-far'));

  blimp.update(SENAC_BLIMP_CONFIG.flightDurationSeconds);
  assert.equal(blimp.phase, 'complete');
  assert.equal(blimp.root.visible, false);
  assert.equal(blimp.setWaveState({ status: 'active', wave: 1 }), false);
  blimp.dispose();
});

test('carrega a imagem fornecida como decal nos dois lados do dirigível', async () => {
  const texture = new Texture();
  const requested = [];
  const blimp = new SenacBlimpSystem({
    scene: new Scene(),
    textureLoader: {
      async loadAsync(url) {
        requested.push(url);
        return texture;
      },
    },
  });

  assert.equal(await blimp.logoLoadPromise, true);
  assert.deepEqual(requested, [SENAC_LOGO_URL]);
  assert.equal(blimp.logoStatus, 'ready');
  assert.equal(blimp.logoMaterial.map, texture);
  assert.deepEqual(texture.repeat.toArray(), [0.82, 0.5]);
  assert.deepEqual(texture.offset.toArray(), [0.09, 0.3]);
  let textureDisposals = 0;
  texture.addEventListener('dispose', () => {
    textureDisposals += 1;
  });
  assert.equal(blimp.dispose(), true);
  assert.equal(blimp.dispose(), false);
  assert.equal(textureDisposals, 1);
});

test('não deixa o easter egg escapar para ondas posteriores', () => {
  const blimp = new SenacBlimpSystem({
    scene: new Scene(),
    textureLoader: null,
  });

  blimp.setWaveState({ status: 'active', wave: 1 });
  assert.equal(blimp.setWaveState({ status: 'active', wave: 2 }), true);
  assert.equal(blimp.phase, 'complete');
  assert.equal(blimp.root.visible, false);
  blimp.dispose();
});

test('detecta o disparo e anima a queda até o chão', () => {
  const blimp = new SenacBlimpSystem({
    scene: new Scene(),
    textureLoader: null,
  });
  blimp.setWaveState({ status: 'active', wave: 1 });
  blimp.update(SENAC_BLIMP_CONFIG.delaySeconds + 0.5);
  const center = blimp.root.position.clone();
  const collision = blimp.intersectProjectile(
    center.clone().add(new Vector3(-10, 0, 0)),
    center.clone().add(new Vector3(10, 0, 0)),
    0.2,
  );

  assert.equal(collision.hit, true);
  assert.equal(blimp.hit(collision.point), true);
  assert.equal(blimp.hit(collision.point), false);
  assert.equal(blimp.phase, 'falling');
  assert.ok(blimp.smokeParticles.some(({ visible }) => visible));

  blimp.update(SENAC_BLIMP_CONFIG.crashDurationSeconds / 2);
  assert.equal(blimp.phase, 'falling');
  assert.ok(blimp.root.position.y < center.y);
  assert.notEqual(blimp.root.rotation.z, 0);

  blimp.update(SENAC_BLIMP_CONFIG.crashDurationSeconds / 2);
  assert.equal(blimp.phase, 'crashed');
  assert.equal(blimp.root.visible, true);
  assert.equal(blimp.root.position.y, SENAC_BLIMP_CONFIG.crashGroundY);
  assert.equal(
    blimp.intersectProjectile(center, center, 0.2),
    null,
  );
  blimp.dispose();
});

test('valida cena e percurso antes de criar recursos', () => {
  assert.throws(() => new SenacBlimpSystem(), /cena Three\.js válida/);
  assert.throws(
    () =>
      new SenacBlimpSystem({
        scene: new Scene(),
        config: {
          ...SENAC_BLIMP_CONFIG,
          flightDurationSeconds: 0,
        },
      }),
    /flightDurationSeconds deve ser positivo/,
  );
});
