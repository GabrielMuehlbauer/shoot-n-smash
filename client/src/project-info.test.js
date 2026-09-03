import assert from 'node:assert/strict';
import test from 'node:test';

import { PROJECT_INFO } from './project-info.js';

test('mantém os metadados aprovados da fase com pontuação', () => {
  assert.equal(PROJECT_INFO.name, "Shoot 'n' Smash");
  assert.equal(PROJECT_INFO.version, '0.14.0');
  assert.equal(PROJECT_INFO.phase, 14);
  assert.equal(PROJECT_INFO.scenario, 'Neve');
  assert.equal(PROJECT_INFO.team.length, 4);
});

test('não permite alteração acidental da lista de integrantes', () => {
  assert.equal(Object.isFrozen(PROJECT_INFO.team), true);
});
