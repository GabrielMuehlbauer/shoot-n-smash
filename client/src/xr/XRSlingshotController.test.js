import assert from 'node:assert/strict';
import test from 'node:test';

import { Group, Scene, Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { calculateBallisticPoint } from '../gameplay/Ballistics.js';
import {
  XRSlingshotController,
  calculateXRChargeRatio,
} from './XRSlingshotController.js';

function createFixture() {
  const controllers = [new Group(), new Group()];
  const ratios = [];
  const releases = [];
  const inputStates = [];
  let starts = 0;
  let cancels = 0;
  const controller = new XRSlingshotController({
    renderer: { xr: { getController: (index) => controllers[index] } },
    scene: new Scene(),
    onChargeStart: () => {
      starts += 1;
      return true;
    },
    onChargeChange: (ratio) => ratios.push(ratio),
    onChargeRelease: (pose) => {
      releases.push(pose);
      return { fired: true };
    },
    onChargeCancel: () => {
      cancels += 1;
    },
    onInputStateChange: (state) => inputStates.push(state),
  });

  controller.connect();
  controller.setActive(true);
  controllers[0].position.set(-0.2, 1.3, -0.4);
  controllers[1].position.set(0.25, 1.2, 0.1);
  controllers[0].dispatchEvent({ type: 'connected', data: { handedness: 'left' } });
  controllers[1].dispatchEvent({ type: 'connected', data: { handedness: 'right' } });
  return {
    cancels: () => cancels,
    controller,
    controllers,
    inputStates,
    ratios,
    releases,
    starts: () => starts,
  };
}

test('converte a distância física em tensão limitada', () => {
  const pull = GAMEPLAY_CONFIG.xr.pullDistance;

  assert.equal(calculateXRChargeRatio(pull.minimum, pull), 0);
  assert.equal(calculateXRChargeRatio(pull.maximum, pull), 1);
  assert.equal(calculateXRChargeRatio(-10, pull), 0);
  assert.equal(calculateXRChargeRatio(10, pull), 1);
  assert.equal(calculateXRChargeRatio(Number.NaN, pull), 0);
});

test('usa esquerda como estilingue e direita para puxar e disparar', () => {
  const fixture = createFixture();

  fixture.controllers[0].dispatchEvent({ type: 'selectstart' });
  assert.equal(fixture.starts(), 0);
  assert.equal(
    fixture.controller.setChargeState({ ammoType: 'special' }),
    true,
  );
  fixture.controllers[1].dispatchEvent({ type: 'selectstart' });
  assert.equal(fixture.starts(), 1);
  assert.equal(fixture.controller.charging, true);
  assert.equal(fixture.controller.update(), true);
  assert.equal(fixture.ratios.length, 1);
  assert.ok(fixture.ratios[0] > 0 && fixture.ratios[0] < 1);
  assert.ok(fixture.controller.visualRoot.getObjectByName('xr-slingshot-left-arm'));
  assert.ok(fixture.controller.visualRoot.getObjectByName('xr-slingshot-right-arm'));
  assert.equal(fixture.controller.aimMarker.visible, true);
  assert.ok(fixture.controller.trajectoryVisual.geometry.drawRange.count > 0);
  assert.equal(
    fixture.controller.projectileVisual.material,
    fixture.controller.projectileMaterials.special,
  );
  assert.equal(
    fixture.controller.trajectoryVisual.material,
    fixture.controller.trajectoryMaterials.special,
  );
  const positions =
    fixture.controller.trajectoryVisual.geometry.getAttribute('position');
  const expectedPoint = calculateBallisticPoint({
    origin: fixture.controller.slingPosition,
    velocity: fixture.controller.shotDirection
      .clone()
      .multiplyScalar(fixture.controller.calculateSpeed()),
    gravity: GAMEPLAY_CONFIG.projectile.gravity,
    timeSeconds: GAMEPLAY_CONFIG.xr.aim.trajectoryStepSeconds,
    target: new Vector3(),
  });
  assert.ok(
    new Vector3(positions.getX(0), positions.getY(0), positions.getZ(0)).distanceTo(
      expectedPoint,
    ) < 1e-5,
  );

  fixture.controllers[1].dispatchEvent({ type: 'selectend' });
  assert.equal(fixture.releases.length, 1);
  assert.ok(
    fixture.releases[0].origin.distanceTo(fixture.controller.slingPosition) < 1e-9,
  );
  assert.ok(fixture.releases[0].direction.length() > 0.999);
  assert.ok(fixture.releases[0].direction.x < 0);
  assert.equal(fixture.controller.charging, false);
  assert.equal(fixture.controller.trajectoryVisual.visible, false);
  assert.equal(fixture.inputStates.at(-1).ready, true);
  fixture.controller.dispose();
});

test('cancela uma carga ao sair do XR', () => {
  const fixture = createFixture();
  fixture.controllers[1].dispatchEvent({ type: 'selectstart' });

  assert.equal(fixture.controller.setActive(false), true);
  assert.equal(fixture.cancels(), 1);
  assert.equal(fixture.controller.charging, false);
  assert.equal(fixture.controller.disconnect(), true);
  assert.equal(fixture.controller.disconnect(), false);
  assert.equal(fixture.controller.dispose(), true);
  assert.equal(fixture.controller.dispose(), false);
});
