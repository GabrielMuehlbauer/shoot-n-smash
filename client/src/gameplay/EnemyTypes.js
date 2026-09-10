import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';

function assertTypeDescriptor(type, index) {
  const prefix = `enemy.types[${index}]`;

  if (!type || typeof type !== 'object') {
    throw new TypeError(`${prefix} deve ser um descritor de tipo.`);
  }

  if (typeof type.id !== 'string' || type.id.trim() === '') {
    throw new TypeError(`${prefix}.id deve ser um texto não vazio.`);
  }

  if (type.id !== type.id.trim()) {
    throw new TypeError(`${prefix}.id não pode ter espaços externos.`);
  }

  if (typeof type.label !== 'string' || type.label.trim() === '') {
    throw new TypeError(`${prefix}.label deve ser um texto não vazio.`);
  }

  if (type.label !== type.label.trim()) {
    throw new TypeError(`${prefix}.label não pode ter espaços externos.`);
  }

  if (!Number.isInteger(type.maxResistance) || type.maxResistance <= 0) {
    throw new RangeError(
      `${prefix}.maxResistance deve ser um inteiro positivo.`,
    );
  }

  if (!Number.isInteger(type.damage) || type.damage <= 0) {
    throw new RangeError(`${prefix}.damage deve ser um inteiro positivo.`);
  }

  if (
    !Number.isInteger(type.color) ||
    type.color < 0 ||
    type.color > 0xffffff
  ) {
    throw new RangeError(`${prefix}.color deve ser uma cor hexadecimal válida.`);
  }

  if (
    type.visualScale !== undefined &&
    (!Number.isFinite(type.visualScale) || type.visualScale <= 0)
  ) {
    throw new RangeError(`${prefix}.visualScale deve ser maior que zero.`);
  }
}

export function validateEnemyTypes(types) {
  if (!Array.isArray(types) || types.length === 0) {
    throw new TypeError('enemy.types deve ser uma lista não vazia.');
  }

  const ids = new Set();

  for (const [index, type] of types.entries()) {
    assertTypeDescriptor(type, index);

    if (ids.has(type.id)) {
      throw new RangeError(`enemy.types contém o id duplicado "${type.id}".`);
    }

    ids.add(type.id);
  }

  return true;
}

export function selectEnemyType({
  types = GAMEPLAY_CONFIG.enemy.types,
  random = Math.random,
} = {}) {
  validateEnemyTypes(types);

  if (typeof random !== 'function') {
    throw new TypeError('A seleção do tipo requer random como função.');
  }

  const value = random();

  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(
      'EnemySystem.typeRandom deve retornar um número entre 0 e 1.',
    );
  }

  const selected = types[Math.floor(value * types.length)];

  const snapshot = {
    id: selected.id,
    label: selected.label,
    maxResistance: selected.maxResistance,
    damage: selected.damage,
    color: selected.color,
  };

  if (selected.visualScale !== undefined) {
    snapshot.visualScale = selected.visualScale;
  }

  return Object.freeze(snapshot);
}
