import { Vector3 } from 'three';

const ROOT_TOLERANCE = Number.EPSILON * 16;

function assertFiniteVector(name, value) {
  if (
    !value ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  ) {
    throw new TypeError(`${name} deve ser um Vector3 finito.`);
  }
}

function assertRadius(name, value) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} deve ser finito.`);
  }

  if (value < 0) {
    throw new RangeError(`${name} não pode ser negativo.`);
  }
}

function createMiss() {
  return {
    hit: false,
    t: null,
    point: null,
    startedInside: false,
  };
}

function createMovingMiss() {
  return {
    ...createMiss(),
    projectileCenter: null,
    targetCenter: null,
  };
}

function copyVector(value) {
  return new Vector3(value.x, value.y, value.z);
}

/**
 * Encontra o primeiro contato entre um segmento e uma esfera estática.
 *
 * O raio pode ser um raio combinado, permitindo tratar um projétil esférico
 * como um ponto contra uma esfera expandida. Nenhuma entrada é modificada.
 */
export function intersectSegmentSphere(start, end, center, combinedRadius) {
  assertFiniteVector('start', start);
  assertFiniteVector('end', end);
  assertFiniteVector('center', center);
  assertRadius('combinedRadius', combinedRadius);

  const segment = new Vector3(
    end.x - start.x,
    end.y - start.y,
    end.z - start.z,
  );
  const offset = new Vector3(
    start.x - center.x,
    start.y - center.y,
    start.z - center.z,
  );
  const radiusSquared = combinedRadius * combinedRadius;
  const c = offset.lengthSq() - radiusSquared;

  if (c <= 0) {
    return {
      hit: true,
      t: 0,
      point: copyVector(start),
      startedInside: true,
    };
  }

  const a = segment.lengthSq();

  if (a === 0) {
    return createMiss();
  }

  // a*t² + b*t + c = 0. O cálculo de q evita o cancelamento
  // catastrófico da fórmula quadrática quando uma raiz está perto de zero.
  const b = 2 * offset.dot(segment);
  const discriminant = b * b - 4 * a * c;
  const discriminantTolerance =
    ROOT_TOLERANCE * Math.max(b * b, Math.abs(4 * a * c), 1);

  if (discriminant < -discriminantTolerance) {
    return createMiss();
  }

  const squareRoot = Math.sqrt(Math.max(0, discriminant));
  let roots;

  if (squareRoot === 0) {
    roots = [-b / (2 * a)];
  } else {
    const q = -0.5 * (b + Math.sign(b || 1) * squareRoot);
    roots = [q / a, c / q].sort((left, right) => left - right);
  }

  const t = roots.find(
    (candidate) =>
      Number.isFinite(candidate) &&
      candidate >= -ROOT_TOLERANCE &&
      candidate <= 1 + ROOT_TOLERANCE,
  );

  if (t === undefined) {
    return createMiss();
  }

  const normalizedT = Math.min(Math.max(t, 0), 1);
  const point = copyVector(start).addScaledVector(segment, normalizedT);

  return {
    hit: true,
    t: normalizedT,
    point,
    startedInside: false,
  };
}

/**
 * Encontra o primeiro contato entre duas esferas que se movem linearmente no
 * mesmo intervalo. A transformação para o movimento relativo converte o alvo
 * em uma esfera estática com a soma dos raios.
 */
export function intersectMovingSpheres(
  projectileStart,
  projectileEnd,
  projectileRadius,
  targetStart,
  targetEnd,
  targetRadius,
) {
  assertFiniteVector('projectileStart', projectileStart);
  assertFiniteVector('projectileEnd', projectileEnd);
  assertRadius('projectileRadius', projectileRadius);
  assertFiniteVector('targetStart', targetStart);
  assertFiniteVector('targetEnd', targetEnd);
  assertRadius('targetRadius', targetRadius);

  const combinedRadius = projectileRadius + targetRadius;

  if (!Number.isFinite(combinedRadius)) {
    throw new RangeError('A soma dos raios deve ser finita.');
  }

  const relativeStart = new Vector3(
    projectileStart.x - targetStart.x,
    projectileStart.y - targetStart.y,
    projectileStart.z - targetStart.z,
  );
  const relativeEnd = new Vector3(
    projectileEnd.x - targetEnd.x,
    projectileEnd.y - targetEnd.y,
    projectileEnd.z - targetEnd.z,
  );
  const relativeHit = intersectSegmentSphere(
    relativeStart,
    relativeEnd,
    new Vector3(),
    combinedRadius,
  );

  if (!relativeHit.hit) {
    return createMovingMiss();
  }

  const projectileCenter = copyVector(projectileStart).lerp(
    copyVector(projectileEnd),
    relativeHit.t,
  );
  const targetCenter = copyVector(targetStart).lerp(
    copyVector(targetEnd),
    relativeHit.t,
  );

  return {
    hit: true,
    t: relativeHit.t,
    point: projectileCenter.clone(),
    startedInside: relativeHit.startedInside,
    projectileCenter,
    targetCenter,
  };
}
