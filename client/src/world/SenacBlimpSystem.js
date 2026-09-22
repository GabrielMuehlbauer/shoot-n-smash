import {
  BoxGeometry,
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';

import { intersectSegmentSphere } from '../gameplay/CollisionSystem.js';

export const SENAC_LOGO_URL = '/assets/textures/senac-logo.jpg';

export const SENAC_BLIMP_CONFIG = Object.freeze({
  delaySeconds: 4.5,
  flightDurationSeconds: 16,
  crashDurationSeconds: 3.2,
  crashGroundY: 2.15,
  crashDriftDistance: 9,
  start: Object.freeze({ x: -58, y: 18, z: -28 }),
  end: Object.freeze({ x: 58, y: 17, z: -24 }),
});

const HIT_SPHERES = Object.freeze([
  Object.freeze({ x: -3.35, y: 0, z: 0, radius: 2.15 }),
  Object.freeze({ x: 0, y: -0.1, z: 0, radius: 2.35 }),
  Object.freeze({ x: 3.35, y: 0, z: 0, radius: 2.15 }),
]);

function validateConfig(config) {
  for (const [name, value] of [
    ['delaySeconds', config?.delaySeconds],
    ['flightDurationSeconds', config?.flightDurationSeconds],
    ['crashDurationSeconds', config?.crashDurationSeconds],
    ['crashDriftDistance', config?.crashDriftDistance],
  ]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`senacBlimp.${name} deve ser finito e não negativo.`);
    }
  }

  for (const name of ['flightDurationSeconds', 'crashDurationSeconds']) {
    if (config[name] <= 0) {
      throw new RangeError(`senacBlimp.${name} deve ser positivo.`);
    }
  }

  if (!Number.isFinite(config.crashGroundY)) {
    throw new RangeError('senacBlimp.crashGroundY deve ser finito.');
  }

  for (const pointName of ['start', 'end']) {
    const point = config?.[pointName];
    if (
      !point ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      !Number.isFinite(point.z)
    ) {
      throw new TypeError(`senacBlimp.${pointName} requer coordenadas finitas.`);
    }
  }
}

export class SenacBlimpSystem {
  constructor({
    scene,
    config = SENAC_BLIMP_CONFIG,
    textureLoader = globalThis.document ? new TextureLoader() : null,
  } = {}) {
    if (!scene?.add || !scene?.remove) {
      throw new TypeError('SenacBlimpSystem requer uma cena Three.js válida.');
    }

    validateConfig(config);
    this.scene = scene;
    this.config = config;
    this.phase = 'waiting';
    this.elapsedSeconds = 0;
    this.disposed = false;
    this.resources = new Set();
    this.start = new Vector3(config.start.x, config.start.y, config.start.z);
    this.end = new Vector3(config.end.x, config.end.y, config.end.z);
    this.flightDirection = new Vector3().subVectors(this.end, this.start);
    this.crashDirection = this.flightDirection.clone().setY(0).normalize();
    this.crashStart = new Vector3();
    this.crashStartRotation = new Euler();
    this.hitboxCenter = new Vector3();
    this.smokeEmissionSeconds = 0;
    this.nextSmokeParticle = 0;
    this.root = this.createBlimp();
    this.smokeGroup = this.createSmoke();
    this.root.visible = false;
    this.scene.add(this.root);
    this.logoStatus = textureLoader ? 'loading' : 'fallback';
    this.logoLoadPromise = textureLoader
      ? this.loadLogo(textureLoader)
      : Promise.resolve(false);
  }

  createBlimp() {
    const root = new Group();
    root.name = 'senac-easter-egg-blimp';
    root.position.copy(this.start);
    root.rotation.y = -Math.atan2(
      this.flightDirection.z,
      this.flightDirection.x,
    );

    const orangeMaterial = new MeshStandardMaterial({
      color: 0xf7941d,
      emissive: 0x321500,
      emissiveIntensity: 0.08,
      roughness: 0.58,
      metalness: 0.04,
    });
    const blueMaterial = new MeshStandardMaterial({
      color: 0x005594,
      emissive: 0x001b32,
      emissiveIntensity: 0.12,
      roughness: 0.52,
      metalness: 0.08,
    });
    const darkMaterial = new MeshStandardMaterial({
      color: 0x173a52,
      roughness: 0.48,
      metalness: 0.22,
    });
    this.logoMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });

    const bodyGeometry = new SphereGeometry(1, 28, 16);
    const cabinGeometry = new BoxGeometry(2.4, 0.72, 1.12);
    const finGeometry = new BoxGeometry(1.8, 0.16, 1.2);
    const hubGeometry = new CylinderGeometry(0.18, 0.18, 0.62, 10);
    const bladeGeometry = new BoxGeometry(0.12, 1.65, 0.18);
    const logoGeometry = new PlaneGeometry(3.6, 2.2);

    for (const resource of [
      orangeMaterial,
      blueMaterial,
      darkMaterial,
      this.logoMaterial,
      bodyGeometry,
      cabinGeometry,
      finGeometry,
      hubGeometry,
      bladeGeometry,
      logoGeometry,
    ]) {
      this.resources.add(resource);
    }

    const body = new Mesh(bodyGeometry, orangeMaterial);
    body.name = 'senac-blimp-envelope';
    body.scale.set(5.4, 1.72, 1.72);

    const cabin = new Mesh(cabinGeometry, blueMaterial);
    cabin.name = 'senac-blimp-cabin';
    cabin.position.set(0.45, -1.72, 0);

    const topFin = new Mesh(finGeometry, blueMaterial);
    topFin.name = 'senac-blimp-top-fin';
    topFin.position.set(-4.35, 1.38, 0);
    topFin.rotation.z = -0.42;

    const sideFin = new Mesh(finGeometry, blueMaterial);
    sideFin.name = 'senac-blimp-side-fin';
    sideFin.position.set(-4.45, 0, 0);
    sideFin.rotation.y = Math.PI / 2;

    const logoNear = new Mesh(logoGeometry, this.logoMaterial);
    logoNear.name = 'senac-blimp-logo-near';
    logoNear.position.set(0.55, 0.05, 1.735);

    const logoFar = new Mesh(logoGeometry, this.logoMaterial);
    logoFar.name = 'senac-blimp-logo-far';
    logoFar.position.set(0.55, 0.05, -1.735);
    logoFar.rotation.y = Math.PI;

    const hub = new Mesh(hubGeometry, darkMaterial);
    hub.name = 'senac-blimp-propeller-hub';
    hub.rotation.z = Math.PI / 2;
    hub.position.x = -5.55;
    this.propeller = new Group();
    this.propeller.name = 'senac-blimp-propeller';
    this.propeller.position.x = -5.88;
    const verticalBlade = new Mesh(bladeGeometry, darkMaterial);
    const horizontalBlade = new Mesh(bladeGeometry, darkMaterial);
    horizontalBlade.rotation.x = Math.PI / 2;
    this.propeller.add(verticalBlade, horizontalBlade);

    root.add(
      body,
      cabin,
      topFin,
      sideFin,
      logoNear,
      logoFar,
      hub,
      this.propeller,
    );
    return root;
  }

  createSmoke() {
    const group = new Group();
    group.name = 'senac-blimp-crash-smoke';
    const geometry = new SphereGeometry(0.72, 8, 6);
    this.resources.add(geometry);
    this.smokeParticles = Array.from({ length: 14 }, (_, index) => {
      const material = new MeshBasicMaterial({
        color: index % 3 === 0 ? 0x2b3138 : 0x59616a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const particle = new Mesh(geometry, material);
      particle.visible = false;
      particle.userData.age = 0;
      particle.userData.life = 1.35;
      particle.userData.velocity = new Vector3();
      this.resources.add(material);
      group.add(particle);
      return particle;
    });
    this.scene.add(group);
    return group;
  }

  async loadLogo(loader) {
    try {
      const texture = await loader.loadAsync(SENAC_LOGO_URL);
      if (this.disposed) {
        texture.dispose?.();
        return false;
      }
      texture.colorSpace = SRGBColorSpace;
      // Recorta apenas a marca dentro da imagem quadrada fornecida.
      texture.repeat.set(0.82, 0.5);
      texture.offset.set(0.09, 0.3);
      texture.needsUpdate = true;
      this.logoTexture = texture;
      this.logoMaterial.map = texture;
      this.logoMaterial.needsUpdate = true;
      this.logoStatus = 'ready';
      return true;
    } catch (error) {
      if (!this.disposed) {
        this.logoStatus = 'error';
        this.logoError = error;
      }
      return false;
    }
  }

  setWaveState(state) {
    if (this.disposed || this.phase === 'complete') {
      return false;
    }

    if (
      this.phase === 'waiting' &&
      state?.status === 'active' &&
      state?.wave === 1
    ) {
      this.phase = 'scheduled';
      this.elapsedSeconds = 0;
      return true;
    }

    if (
      this.phase === 'scheduled' &&
      Number.isFinite(state?.wave) &&
      state.wave > 1
    ) {
      this.finish();
      return true;
    }

    return false;
  }

  update(deltaSeconds) {
    if (
      this.disposed ||
      !['scheduled', 'flying', 'falling'].includes(this.phase)
    ) {
      return false;
    }

    const delta = Number.isFinite(deltaSeconds)
      ? Math.max(0, deltaSeconds)
      : 0;
    this.elapsedSeconds += delta;

    if (this.phase === 'falling') {
      this.updateCrash(delta);
      return true;
    }

    if (this.phase === 'scheduled') {
      if (this.elapsedSeconds < this.config.delaySeconds) {
        return true;
      }
      this.elapsedSeconds -= this.config.delaySeconds;
      this.phase = 'flying';
      this.root.visible = true;
    }

    const progress = Math.min(
      this.elapsedSeconds / this.config.flightDurationSeconds,
      1,
    );
    this.root.position.lerpVectors(this.start, this.end, progress);
    this.root.position.y += Math.sin(progress * Math.PI * 4) * 0.35;
    this.root.rotation.z = Math.sin(progress * Math.PI * 2) * 0.018;
    this.propeller.rotation.x += delta * 15;
    const fadeScale = Math.min(progress / 0.08, (1 - progress) / 0.08, 1);
    this.root.scale.setScalar(0.88 + Math.max(fadeScale, 0) * 0.12);

    if (progress >= 1) {
      this.finish();
    }

    return true;
  }

  intersectProjectile(start, end, projectileRadius = 0) {
    if (
      this.disposed ||
      this.phase !== 'flying' ||
      !this.root.visible ||
      !Number.isFinite(projectileRadius) ||
      projectileRadius < 0
    ) {
      return null;
    }

    this.root.updateWorldMatrix(true, false);
    let nearest = null;

    for (const hitSphere of HIT_SPHERES) {
      this.hitboxCenter
        .set(hitSphere.x, hitSphere.y, hitSphere.z)
        .applyMatrix4(this.root.matrixWorld);
      const collision = intersectSegmentSphere(
        start,
        end,
        this.hitboxCenter,
        hitSphere.radius * this.root.scale.x + projectileRadius,
      );

      if (collision.hit && (!nearest || collision.t < nearest.t)) {
        nearest = collision;
      }
    }

    return nearest;
  }

  hit(impactPoint = this.root.position) {
    if (this.disposed || this.phase !== 'flying') {
      return false;
    }

    this.phase = 'falling';
    this.elapsedSeconds = 0;
    this.smokeEmissionSeconds = 0;
    this.crashStart.copy(this.root.position);
    this.crashStartRotation.copy(this.root.rotation);
    this.emitSmoke(impactPoint);
    return true;
  }

  updateCrash(deltaSeconds) {
    const progress = Math.min(
      this.elapsedSeconds / this.config.crashDurationSeconds,
      1,
    );
    const fallProgress = progress * progress;
    this.root.position
      .copy(this.crashStart)
      .addScaledVector(
        this.crashDirection,
        this.config.crashDriftDistance * progress,
      );
    this.root.position.y =
      this.crashStart.y +
      (this.config.crashGroundY - this.crashStart.y) * fallProgress;
    this.root.rotation.x = this.crashStartRotation.x + progress * 0.55;
    this.root.rotation.y = this.crashStartRotation.y + progress * 0.2;
    this.root.rotation.z =
      this.crashStartRotation.z - progress * Math.PI * 3.4;
    this.propeller.rotation.x += deltaSeconds * 15 * (1 - progress);

    this.smokeEmissionSeconds += deltaSeconds;
    while (this.smokeEmissionSeconds >= 0.11 && progress < 0.96) {
      this.smokeEmissionSeconds -= 0.11;
      this.emitSmoke(this.root.position);
    }
    this.updateSmoke(deltaSeconds);

    if (progress >= 1) {
      this.root.position.y = this.config.crashGroundY;
      this.phase = 'crashed';
    }
  }

  emitSmoke(position) {
    const particle = this.smokeParticles[this.nextSmokeParticle];
    const index = this.nextSmokeParticle;
    this.nextSmokeParticle = (index + 1) % this.smokeParticles.length;
    particle.position.copy(position);
    particle.position.x += ((index % 3) - 1) * 0.28;
    particle.position.z += (((index * 2) % 3) - 1) * 0.24;
    particle.scale.setScalar(0.45 + (index % 4) * 0.08);
    particle.material.opacity = 0.72;
    particle.visible = true;
    particle.userData.age = 0;
    particle.userData.life = 1.2 + (index % 5) * 0.1;
    particle.userData.velocity.set(
      -this.crashDirection.x * 1.5 + ((index % 3) - 1) * 0.2,
      1.4 + (index % 4) * 0.16,
      -this.crashDirection.z * 1.5,
    );
  }

  updateSmoke(deltaSeconds) {
    for (const particle of this.smokeParticles) {
      if (!particle.visible) continue;
      particle.userData.age += deltaSeconds;
      const progress = particle.userData.age / particle.userData.life;
      if (progress >= 1) {
        particle.visible = false;
        particle.material.opacity = 0;
        continue;
      }
      particle.position.addScaledVector(
        particle.userData.velocity,
        deltaSeconds,
      );
      particle.scale.multiplyScalar(1 + deltaSeconds * 0.7);
      particle.material.opacity = (1 - progress) * 0.72;
    }
  }

  finish() {
    this.phase = 'complete';
    this.root.visible = false;
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.root.removeFromParent();
    this.smokeGroup?.removeFromParent();
    this.logoTexture?.dispose?.();
    for (const resource of this.resources) {
      resource.dispose?.();
    }
    this.resources.clear();
    this.disposed = true;
    return true;
  }
}
