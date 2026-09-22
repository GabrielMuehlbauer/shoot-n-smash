import assert from 'node:assert/strict';
import test from 'node:test';

import { Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import {
  FLYING_ENEMY_STATES,
  FlyingEnemyController,
} from './FlyingEnemyController.js';

test('executa mergulho com impacto e retirada para altitude segura', () => {
  const controller = new FlyingEnemyController(GAMEPLAY_CONFIG.enemy.flying);
  const position = new Vector3(8, 7.5, 0);
  const playerPosition = new Vector3(0, 1.05, 0);
  let impacts = 0;

  controller.reset(position, playerPosition);
  controller.beginAttack(position, playerPosition, 2);
  assert.equal(controller.state, FLYING_ENEMY_STATES.DIVE);

  for (let index = 0; index < 20 && impacts === 0; index += 1) {
    controller.update(0.1, {
      position,
      playerPosition,
      moveSpeed: 2,
      onDiveImpact: () => { impacts += 1; },
    });
  }

  assert.equal(impacts, 1);
  assert.ok(position.y < GAMEPLAY_CONFIG.enemy.flying.minAltitude);
  controller.update(1, { position, playerPosition, moveSpeed: 2 });
  controller.update(1, { position, playerPosition, moveSpeed: 2 });
  assert.ok(position.y >= GAMEPLAY_CONFIG.enemy.flying.minAltitude);
});

test('dispara uma vez por ataque a distância e conclui a queda', () => {
  const controller = new FlyingEnemyController(GAMEPLAY_CONFIG.enemy.flying);
  const position = new Vector3(7, 7, 0);
  const playerPosition = new Vector3(0, 1, 0);
  let shots = 0;
  let deaths = 0;

  controller.reset(position, playerPosition);
  controller.nextAttack = FLYING_ENEMY_STATES.RANGED;
  controller.beginAttack(position, playerPosition, 2);
  controller.update(0.4, {
    position,
    playerPosition,
    moveSpeed: 2,
    onRangedFire: () => { shots += 1; },
  });
  controller.update(0.3, {
    position,
    playerPosition,
    moveSpeed: 2,
    onRangedFire: () => { shots += 1; },
  });
  assert.equal(shots, 1);

  controller.beginDeath();
  controller.update(GAMEPLAY_CONFIG.enemy.flying.deathDurationSeconds, {
    position,
    playerPosition,
    moveSpeed: 2,
    onDeathComplete: () => { deaths += 1; },
  });
  assert.equal(controller.state, FLYING_ENEMY_STATES.DEATH);
  assert.equal(deaths, 1);
});
