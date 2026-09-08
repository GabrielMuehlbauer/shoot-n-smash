import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  Quaternion,
} from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { describeEnemyState } from '../enemy-hud.js';
import { describePlayerHealth } from '../player-hud.js';
import { describeScoreState } from '../score-hud.js';
import { describeWaveState } from '../wave-hud.js';

function validateConfig(config) {
  for (const [name, value] of [
    ['canvasWidth', config?.canvasWidth],
    ['canvasHeight', config?.canvasHeight],
    ['widthMeters', config?.widthMeters],
    ['heightMeters', config?.heightMeters],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`xr.hud.${name} deve ser maior que zero.`);
    }
  }

  const position = config?.position;
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    throw new TypeError('xr.hud.position deve conter x, y e z finitos.');
  }
}

function createDefaultCanvas() {
  const canvas = document.createElement('canvas');
  return canvas;
}

function drawBar(context, { x, y, width, value, color }) {
  const normalizedValue = Math.min(Math.max(Number(value) || 0, 0), 1);
  context.fillStyle = 'rgba(159, 201, 218, 0.2)';
  context.fillRect(x, y, width, 12);
  context.fillStyle = color;
  context.fillRect(x, y, width * normalizedValue, 12);
}

export class XRHudSystem {
  constructor({
    renderer,
    scene,
    camera,
    canvasFactory = createDefaultCanvas,
    config = GAMEPLAY_CONFIG.xr.hud,
  } = {}) {
    if (!renderer?.xr?.getCamera) {
      throw new Error('XRHudSystem requer um renderer WebXR.');
    }

    if (!scene?.add || !scene?.remove) {
      throw new Error('XRHudSystem requer uma cena Three.js válida.');
    }

    if (!camera?.getWorldPosition || !camera?.getWorldQuaternion) {
      throw new Error('XRHudSystem requer uma câmera Three.js válida.');
    }

    if (typeof canvasFactory !== 'function') {
      throw new TypeError('XRHudSystem requer uma fábrica de canvas.');
    }

    validateConfig(config);
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.config = config;
    this.active = false;
    this.disposed = false;
    this.cameraPosition = new Vector3();
    this.cameraQuaternion = new Quaternion();
    this.localOffset = new Vector3(
      config.position.x,
      config.position.y,
      config.position.z,
    );
    this.worldOffset = new Vector3();
    this.playerState = {
      health: GAMEPLAY_CONFIG.player.initialHealth,
      maxHealth: GAMEPLAY_CONFIG.player.maxHealth,
    };
    const defaultEnemy = GAMEPLAY_CONFIG.enemy.types[0];
    this.enemyState = {
      active: true,
      maxResistance: defaultEnemy.maxResistance,
      outcome: null,
      resistance: defaultEnemy.maxResistance,
      type: defaultEnemy,
    };
    const firstWave = GAMEPLAY_CONFIG.waves.definitions[0];
    this.waveState = {
      status: 'active',
      wave: firstWave.number,
      totalWaves: GAMEPLAY_CONFIG.waves.definitions.length,
      enemy: 1,
      enemiesInWave: firstWave.enemyCount,
    };
    this.scoreState = { score: 0, eventCount: 0, lastEvent: null };

    try {
      this.canvas = canvasFactory();
      this.canvas.width = config.canvasWidth;
      this.canvas.height = config.canvasHeight;
      this.context = this.canvas.getContext?.('2d');

      if (!this.context) {
        throw new Error('XRHudSystem não conseguiu criar o contexto 2D.');
      }

      this.texture = new CanvasTexture(this.canvas);
      this.texture.colorSpace = SRGBColorSpace;
      this.geometry = new PlaneGeometry(config.widthMeters, config.heightMeters);
      this.material = new MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      this.panel = new Mesh(this.geometry, this.material);
      this.panel.name = 'xr-gameplay-hud';
      this.panel.frustumCulled = false;
      this.panel.renderOrder = 1000;
      this.panel.visible = false;
      this.scene.add(this.panel);
      this.redraw();
    } catch (error) {
      this.disposeResources();
      throw error;
    }
  }

  setActive(active) {
    if (this.disposed) {
      return false;
    }

    const nextActive = Boolean(active);
    if (this.active === nextActive) {
      return false;
    }

    this.active = nextActive;
    this.panel.visible = nextActive;
    return true;
  }

  setPlayerState(state) {
    describePlayerHealth(state);
    this.playerState = state;
    return this.redraw();
  }

  setEnemyState(state) {
    describeEnemyState(state);
    this.enemyState = state;
    return this.redraw();
  }

  setWaveState(state) {
    describeWaveState(state, {
      bossReturning: this.enemyState?.type?.id === 'boss',
    });
    this.waveState = state;
    return this.redraw();
  }

  setScoreState(state) {
    describeScoreState(state);
    this.scoreState = state;
    return this.redraw();
  }

  redraw() {
    if (this.disposed || !this.context) {
      return false;
    }

    const player = describePlayerHealth(this.playerState);
    const enemy = describeEnemyState(this.enemyState);
    const wave = describeWaveState(this.waveState, {
      bossReturning: this.enemyState?.type?.id === 'boss',
    });
    const score = describeScoreState(this.scoreState);
    const context = this.context;
    const width = this.config.canvasWidth;
    const height = this.config.canvasHeight;

    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgba(5, 20, 39, 0.88)';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(126, 231, 255, 0.72)';
    context.lineWidth = 5;
    context.strokeRect(3, 3, width - 6, height - 6);
    context.textBaseline = 'top';
    context.font = '700 32px system-ui, sans-serif';
    context.fillStyle = '#8eafc0';
    context.fillText('JOGADOR', 44, 34);
    context.fillText(enemy.labelText.toLocaleUpperCase('pt-BR'), 548, 34);
    context.font = '800 46px system-ui, sans-serif';
    context.fillStyle = '#f5fbff';
    context.fillText(player.valueText, 44, 76);
    context.fillText(enemy.valueText, 548, 76);
    drawBar(context, {
      x: 44,
      y: 136,
      width: 410,
      value: player.percent / 100,
      color: player.percent <= 30 ? '#ff7382' : '#62e8aa',
    });
    drawBar(context, {
      x: 548,
      y: 136,
      width: 430,
      value: enemy.percent / 100,
      color: enemy.typeId === 'boss' ? '#ffd978' : '#7ee7ff',
    });
    context.fillStyle = 'rgba(126, 231, 255, 0.22)';
    context.fillRect(44, 180, 934, 2);
    context.font = '800 35px system-ui, sans-serif';
    context.fillStyle = '#ffffff';
    context.fillText(wave.label, 44, 210);
    context.font = '600 29px system-ui, sans-serif';
    context.fillStyle = '#b9d7e4';
    context.fillText(wave.detail, 44, 256);
    context.textAlign = 'right';
    context.font = '800 38px system-ui, sans-serif';
    context.fillStyle = '#83f5c1';
    context.fillText(`PONTOS ${score.valueText}`, 978, 224);
    context.textAlign = 'left';
    this.texture.needsUpdate = true;
    return true;
  }

  update() {
    if (!this.active || this.disposed) {
      return false;
    }

    const xrCamera = this.renderer.xr.getCamera(this.camera) ?? this.camera;
    xrCamera.updateWorldMatrix?.(true, false);
    xrCamera.getWorldPosition(this.cameraPosition);
    xrCamera.getWorldQuaternion(this.cameraQuaternion);
    this.worldOffset.copy(this.localOffset).applyQuaternion(this.cameraQuaternion);
    this.panel.position.copy(this.cameraPosition).add(this.worldOffset);
    this.panel.quaternion.copy(this.cameraQuaternion);
    return true;
  }

  disposeResources() {
    if (this.panel) {
      this.scene?.remove?.(this.panel);
    }
    this.geometry?.dispose?.();
    this.material?.dispose?.();
    this.texture?.dispose?.();
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.disposeResources();
    this.active = false;
    this.disposed = true;
    return true;
  }
}
