import { Vector3 } from 'three';

function assertFiniteVector(name, value) {
  if (
    !value ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  ) {
    throw new TypeError(`${name} deve ser um vetor tridimensional finito.`);
  }
}

function assertStep(gravity, timeSeconds) {
  if (!Number.isFinite(gravity)) {
    throw new TypeError('A gravidade deve ser finita.');
  }
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
    throw new RangeError('O tempo balístico deve ser finito e não negativo.');
  }
}

export function calculateBallisticPoint({
  origin,
  velocity,
  gravity,
  timeSeconds,
  target = new Vector3(),
} = {}) {
  assertFiniteVector('origin', origin);
  assertFiniteVector('velocity', velocity);
  assertStep(gravity, timeSeconds);

  if (typeof target?.copy !== 'function' || typeof target?.addScaledVector !== 'function') {
    throw new TypeError('O destino balístico deve ser um vetor mutável.');
  }

  target.copy(origin).addScaledVector(velocity, timeSeconds);
  target.y += 0.5 * gravity * timeSeconds * timeSeconds;
  return target;
}

export function integrateBallisticStep({
  position,
  velocity,
  gravity,
  deltaSeconds,
} = {}) {
  assertFiniteVector('position', position);
  assertFiniteVector('velocity', velocity);
  assertStep(gravity, deltaSeconds);

  position.addScaledVector(velocity, deltaSeconds);
  position.y += 0.5 * gravity * deltaSeconds * deltaSeconds;
  velocity.y += gravity * deltaSeconds;
  return position;
}
