import assert from 'node:assert/strict';
import test from 'node:test';

import { readEnvironment } from '../src/config/env.js';

test('aceita uma porta inteira dentro do intervalo TCP', () => {
  assert.equal(readEnvironment({ PORT: '3300' }).port, 3300);
});

for (const invalidPort of ['0', '65536', '3000abc', '3000.5', '']) {
  test(`rejeita PORT inválida: "${invalidPort}"`, () => {
    assert.throws(
      () => readEnvironment({ PORT: invalidPort }),
      /PORT deve ser um número inteiro entre 1 e 65535/,
    );
  });
}
