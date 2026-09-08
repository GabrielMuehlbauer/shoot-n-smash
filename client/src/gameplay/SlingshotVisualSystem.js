import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { calculateBallisticPoint } from './Ballistics.js';

const UP = new Vector3(0, 1, 0);

function assertFiniteVectorConfig(name, value) {
  if (
    !value ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  ) {
    throw new TypeError(`${name} deve conter x, y e z finitos.`);
  }
}

function validateConfig(config, projectileConfig) {
  assertFiniteVectorConfig('slingshotVisual.position', config?.position);
  assertFiniteVectorConfig('projectile.spawnOffset', projectileConfig?.spawnOffset);

  for (const [name, value] of [
    ['handle.length', config?.handle?.length],
    ['handle.radius', config?.handle?.radius],
    ['fork.tipX', config?.fork?.tipX],
    ['fork.tipY', config?.fork?.tipY],
    ['fork.radius', config?.fork?.radius],
    ['pouch.radius', config?.pouch?.radius],
    ['pouch.pullDistance', config?.pouch?.pullDistance],
    ['loadedBall.radius', config?.loadedBall?.radius],
    ['band.width', config?.band?.width],
    ['trajectory.pointSize', config?.trajectory?.pointSize],
    ['trajectory.stepSeconds', config?.trajectory?.stepSeconds],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`slingshotVisual.${name} deve ser maior que zero.`);
    }
  }

  if (
    !Number.isInteger(config.trajectory.pointCount) ||
    config.trajectory.pointCount < 2
  ) {
    throw new RangeError(
      'slingshotVisual.trajectory.pointCount deve ser um inteiro maior que um.',
    );
  }

  for (const [name, value] of [
    ['minSpeed', projectileConfig?.minSpeed],
    ['maxSpeed', projectileConfig?.maxSpeed],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`projectile.${name} deve ser maior que zero.`);
    }
  }

  if (!Number.isFinite(projectileConfig.gravity)) {
    throw new TypeError('projectile.gravity deve ser finito.');
  }

  if (!Number.isFinite(projectileConfig.groundY)) {
    throw new TypeError('projectile.groundY deve ser finito.');
  }

  for (const [name, value] of [
    ['pouch.y', config.pouch.y],
    ['pouch.restZ', config.pouch.restZ],
  ]) {
    if (!Number.isFinite(value)) {
      throw new TypeError(`slingshotVisual.${name} deve ser finito.`);
    }
  }

  if (projectileConfig.maxSpeed < projectileConfig.minSpeed) {
    throw new RangeError('projectile.maxSpeed não pode ser menor que minSpeed.');
  }
}

function createCylinderBetween({ geometry, material, start, end, name }) {
  const direction = new Vector3().subVectors(end, start);
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = direction.length();
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  return mesh;
}

export class SlingshotVisualSystem {
  constructor({
    scene,
    camera,
    config = GAMEPLAY_CONFIG.slingshotVisual,
    projectileConfig = GAMEPLAY_CONFIG.projectile,
  } = {}) {
    if (!scene?.add || !scene?.remove) {
      throw new Error('SlingshotVisualSystem requer uma cena Three.js válida.');
    }

    if (
      !camera?.getWorldDirection ||
      !camera?.getWorldPosition ||
      !camera?.getWorldQuaternion
    ) {
      throw new Error('SlingshotVisualSystem requer uma câmera Three.js válida.');
    }

    validateConfig(config, projectileConfig);
    this.scene = scene;
    this.camera = camera;
    this.config = config;
    this.projectileConfig = projectileConfig;
    this.disposed = false;
    this.worldCameraPosition = new Vector3();
    this.worldCameraQuaternion = new Quaternion();
    this.worldDirection = new Vector3();
    this.trajectoryOrigin = new Vector3();
    this.trajectoryVelocity = new Vector3();
    this.trajectoryPoint = new Vector3();
    this.localSpawnOffset = new Vector3(
      projectileConfig.spawnOffset.x,
      projectileConfig.spawnOffset.y,
      projectileConfig.spawnOffset.z,
    );
    this.resources = new Set();

    try {
      this.root = this.createSlingshot();
      this.trajectory = this.createTrajectory();
      this.scene.add(this.root, this.trajectory);
      this.update({ charging: false, ratio: 0, speed: projectileConfig.minSpeed });
    } catch (error) {
      if (this.root) {
        this.scene.remove(this.root);
      }
      if (this.trajectory) {
        this.scene.remove(this.trajectory);
      }
      for (const resource of this.resources) {
        resource.dispose();
      }
      this.resources.clear();
      this.disposed = true;
      throw error;
    }
  }

  createSlingshot() {
    const { colors, fork, handle, position } = this.config;
    const root = new Group();
    root.name = 'first-person-slingshot';
    root.position.set(position.x, position.y, position.z);

    const woodMaterial = new MeshStandardMaterial({
      color: colors.wood,
      roughness: 0.72,
      metalness: 0.02,
      depthWrite: false,
    });
    const pouchMaterial = new MeshStandardMaterial({
      color: colors.pouch,
      roughness: 0.84,
      metalness: 0,
      depthWrite: false,
    });
    const ballMaterial = new MeshStandardMaterial({
      color: colors.snowball,
      emissive: colors.snowballEmissive,
      emissiveIntensity: 0.14,
      roughness: 0.92,
      depthWrite: false,
    });
    const specialBallMaterial = new MeshStandardMaterial({
      color: colors.specialBall,
      emissive: colors.specialBallEmissive,
      emissiveIntensity: 0.9,
      roughness: 0.72,
      depthWrite: false,
    });
    const handleGeometry = new CylinderGeometry(
      handle.radius * 0.88,
      handle.radius,
      handle.length,
      10,
    );
    const armGeometry = new CylinderGeometry(
      fork.radius,
      fork.radius * 1.08,
      1,
      8,
    );
    const pouchGeometry = new SphereGeometry(this.config.pouch.radius, 10, 8);
    const ballGeometry = new SphereGeometry(this.config.loadedBall.radius, 12, 9);

    for (const resource of [
      woodMaterial,
      pouchMaterial,
      ballMaterial,
      specialBallMaterial,
      handleGeometry,
      armGeometry,
      pouchGeometry,
      ballGeometry,
    ]) {
      this.resources.add(resource);
    }

    const handleMesh = new Mesh(handleGeometry, woodMaterial);
    handleMesh.name = 'slingshot-handle';
    handleMesh.position.y = -handle.length / 2;
    const forkBase = new Vector3(0, 0, 0);
    this.leftTip = new Vector3(-fork.tipX, fork.tipY, 0);
    this.rightTip = new Vector3(fork.tipX, fork.tipY, 0);
    const leftArm = createCylinderBetween({
      geometry: armGeometry,
      material: woodMaterial,
      start: forkBase,
      end: this.leftTip,
      name: 'slingshot-left-arm',
    });
    const rightArm = createCylinderBetween({
      geometry: armGeometry,
      material: woodMaterial,
      start: forkBase,
      end: this.rightTip,
      name: 'slingshot-right-arm',
    });

    this.pouch = new Mesh(pouchGeometry, pouchMaterial);
    this.pouch.name = 'slingshot-pouch';
    this.pouch.scale.set(1.25, 0.58, 0.5);
    this.loadedBall = new Mesh(ballGeometry, ballMaterial);
    this.loadedBall.name = 'slingshot-loaded-projectile';
    this.loadedBallMaterials = { normal: ballMaterial, special: specialBallMaterial };
    this.loadedBall.visible = false;

    this.leftBand = this.createBand('slingshot-left-band');
    this.rightBand = this.createBand('slingshot-right-band');
    root.add(
      handleMesh,
      leftArm,
      rightArm,
      this.leftBand,
      this.rightBand,
      this.pouch,
      this.loadedBall,
    );
    root.traverse((object) => {
      object.renderOrder = 20;
    });
    return root;
  }

  createBand(name) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(6), 3),
    );
    const material = new LineBasicMaterial({
      color: this.config.colors.band,
      linewidth: this.config.band.width,
      depthWrite: false,
    });
    this.resources.add(geometry);
    this.resources.add(material);
    const band = new Line(geometry, material);
    band.name = name;
    return band;
  }

  createTrajectory() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        new Float32Array(this.config.trajectory.pointCount * 3),
        3,
      ),
    );
    geometry.setDrawRange(0, 0);
    const normalMaterial = new PointsMaterial({
      color: this.config.colors.trajectory,
      size: this.config.trajectory.pointSize,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const specialMaterial = new PointsMaterial({
      color: this.config.colors.specialTrajectory,
      size: this.config.trajectory.pointSize * 1.18,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    });
    for (const resource of [geometry, normalMaterial, specialMaterial]) {
      this.resources.add(resource);
    }
    this.trajectoryMaterials = {
      normal: normalMaterial,
      special: specialMaterial,
    };
    const trajectory = new Points(geometry, normalMaterial);
    trajectory.name = 'slingshot-trajectory-preview';
    trajectory.frustumCulled = false;
    trajectory.renderOrder = 19;
    return trajectory;
  }

  update({ charging, ratio, speed, ammoType = 'normal' } = {}) {
    if (this.disposed) {
      return false;
    }

    const safeRatio = Math.min(Math.max(Number(ratio) || 0, 0), 1);
    const safeSpeed = Number(speed);
    const selectedAmmo = ammoType === 'special' ? 'special' : 'normal';
    this.camera.updateWorldMatrix?.(true, false);
    this.camera.getWorldPosition(this.worldCameraPosition);
    this.camera.getWorldQuaternion(this.worldCameraQuaternion);
    this.camera.getWorldDirection(this.worldDirection).normalize();
    this.root.position
      .set(
        this.config.position.x,
        this.config.position.y,
        this.config.position.z,
      )
      .applyQuaternion(this.worldCameraQuaternion)
      .add(this.worldCameraPosition);
    this.root.quaternion.copy(this.worldCameraQuaternion);

    const pouchZ = this.config.pouch.restZ + this.config.pouch.pullDistance * safeRatio;
    this.pouch.position.set(0, this.config.pouch.y, pouchZ);
    this.loadedBall.position.set(0, this.config.pouch.y, pouchZ - 0.018);
    this.loadedBall.visible = Boolean(charging);
    this.loadedBall.material = this.loadedBallMaterials[selectedAmmo];
    this.updateBand(this.leftBand, this.leftTip, this.pouch.position);
    this.updateBand(this.rightBand, this.rightTip, this.pouch.position);

    if (charging && Number.isFinite(safeSpeed) && safeSpeed > 0) {
      this.updateTrajectory(safeSpeed, selectedAmmo);
    } else {
      this.trajectory.geometry.setDrawRange(0, 0);
    }

    return true;
  }

  setVisible(visible) {
    if (this.disposed) {
      return false;
    }

    const nextVisible = Boolean(visible);

    if (this.root.visible === nextVisible) {
      return false;
    }

    this.root.visible = nextVisible;
    this.trajectory.visible = nextVisible;
    return true;
  }

  updateBand(band, start, end) {
    const positions = band.geometry.getAttribute('position');
    positions.setXYZ(0, start.x, start.y, start.z);
    positions.setXYZ(1, end.x, end.y, end.z);
    positions.needsUpdate = true;
    band.geometry.computeBoundingSphere();
  }

  updateTrajectory(speed, ammoType) {
    this.trajectoryOrigin
      .copy(this.localSpawnOffset)
      .applyQuaternion(this.worldCameraQuaternion)
      .add(this.worldCameraPosition);
    this.trajectoryVelocity.copy(this.worldDirection).multiplyScalar(speed);
    this.trajectory.material = this.trajectoryMaterials[ammoType];
    const positions = this.trajectory.geometry.getAttribute('position');
    const { pointCount, stepSeconds } = this.config.trajectory;
    let visiblePoints = 0;

    for (let index = 0; index < pointCount; index += 1) {
      const time = (index + 1) * stepSeconds;
      calculateBallisticPoint({
        origin: this.trajectoryOrigin,
        velocity: this.trajectoryVelocity,
        gravity: this.projectileConfig.gravity,
        timeSeconds: time,
        target: this.trajectoryPoint,
      });

      if (
        this.trajectoryPoint.y - this.projectileConfig.radius <=
        this.projectileConfig.groundY
      ) {
        break;
      }

      positions.setXYZ(
        index,
        this.trajectoryPoint.x,
        this.trajectoryPoint.y,
        this.trajectoryPoint.z,
      );
      visiblePoints += 1;
    }

    positions.needsUpdate = true;
    this.trajectory.geometry.setDrawRange(0, visiblePoints);
    if (visiblePoints > 0) {
      this.trajectory.geometry.computeBoundingSphere();
    }
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.scene.remove(this.root, this.trajectory);
    for (const resource of this.resources) {
      resource.dispose();
    }
    this.resources.clear();
    this.disposed = true;
    return true;
  }
}
