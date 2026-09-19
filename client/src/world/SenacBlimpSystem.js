import {
  BoxGeometry,
  CylinderGeometry,
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

export const SENAC_LOGO_URL = '/assets/textures/senac-logo.jpg';

export const SENAC_BLIMP_CONFIG = Object.freeze({
  delaySeconds: 4.5,
  flightDurationSeconds: 16,
  start: Object.freeze({ x: -58, y: 22, z: -44 }),
  end: Object.freeze({ x: 58, y: 20, z: -38 }),
});

function validateConfig(config) {
  for (const [name, value] of [
    ['delaySeconds', config?.delaySeconds],
    ['flightDurationSeconds', config?.flightDurationSeconds],
  ]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`senacBlimp.${name} deve ser finito e não negativo.`);
    }
  }

  if (config.flightDurationSeconds <= 0) {
    throw new RangeError('senacBlimp.flightDurationSeconds deve ser positivo.');
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
    this.root = this.createBlimp();
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
    if (this.disposed || !['scheduled', 'flying'].includes(this.phase)) {
      return false;
    }

    const delta = Number.isFinite(deltaSeconds)
      ? Math.max(0, deltaSeconds)
      : 0;
    this.elapsedSeconds += delta;

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

  finish() {
    this.phase = 'complete';
    this.root.visible = false;
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.root.removeFromParent();
    this.logoTexture?.dispose?.();
    for (const resource of this.resources) {
      resource.dispose?.();
    }
    this.resources.clear();
    this.disposed = true;
    return true;
  }
}
