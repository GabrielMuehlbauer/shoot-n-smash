import {
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

import { RENDER_CONFIG } from '../config/render-config.js';
import { SNOW_ARENA_CONFIG } from '../config/snow-arena-config.js';
import { resizeRendererToContainer } from '../utils/viewport.js';
import { SnowArena } from '../world/SnowArena.js';

export class RenderContext {
  constructor(
    container,
    {
      windowRef = window,
      ResizeObserverClass = globalThis.ResizeObserver,
    } = {},
  ) {
    if (!container?.append) {
      throw new Error('RenderContext requer um contêiner HTML válido.');
    }

    this.container = container;
    this.windowRef = windowRef;
    this.ResizeObserverClass = ResizeObserverClass;
    this.disposed = false;
    this.animationLoop = null;

    this.resize = this.resize.bind(this);

    this.scene = new Scene();
    this.scene.background = new Color(RENDER_CONFIG.renderer.clearColor);

    this.camera = this.createCamera();

    try {
      this.renderer = this.createRenderer();
      this.container.append(this.renderer.domElement);

      this.createLights();
      this.createGround();
      this.iceBeacon = this.createIceBeacon();
      this.connectResizeObserver();
      this.resize();
    } catch (error) {
      try {
        this.dispose();
      } catch {
        // Preserva o erro original de inicialização após a melhor limpeza possível.
      }

      throw error;
    }
  }

  createCamera() {
    const cameraConfig = RENDER_CONFIG.camera;
    const camera = new PerspectiveCamera(
      cameraConfig.fov,
      1,
      cameraConfig.near,
      cameraConfig.far,
    );

    camera.position.set(
      cameraConfig.position.x,
      cameraConfig.position.y,
      cameraConfig.position.z,
    );
    camera.lookAt(
      cameraConfig.lookAt.x,
      cameraConfig.lookAt.y,
      cameraConfig.lookAt.z,
    );

    return camera;
  }

  createRenderer() {
    const renderer = new WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });

    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(RENDER_CONFIG.renderer.clearColor);
    renderer.domElement.dataset.gameCanvas = 'true';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute(
      'aria-label',
      'Protótipo 3D de uma arena cercada por neve, gelo e montanhas.',
    );

    return renderer;
  }

  createLights() {
    const hemisphereLight = new HemisphereLight(0xdff7ff, 0x17304b, 2.15);
    const directionalLight = new DirectionalLight(0xffffff, 2.6);
    directionalLight.position.set(-4, 8, 2);

    this.scene.add(hemisphereLight, directionalLight);
  }

  createGround() {
    this.scene.background = new Color(SNOW_ARENA_CONFIG.fog.color);
    this.scene.fog = new Fog(
      SNOW_ARENA_CONFIG.fog.color,
      SNOW_ARENA_CONFIG.fog.near,
      SNOW_ARENA_CONFIG.fog.far,
    );
    this.snowArena = new SnowArena();
    this.scene.add(this.snowArena);
  }

  createIceBeacon() {
    const group = new Group();
    group.position.set(0, 0, -6);

    const base = new Mesh(
      new CylinderGeometry(1.15, 1.55, 0.35, 8),
      new MeshStandardMaterial({
        color: 0x397b9d,
        metalness: 0.08,
        roughness: 0.72,
      }),
    );
    base.position.y = 0.175;

    const marker = new Mesh(
      new IcosahedronGeometry(0.9, 1),
      new MeshStandardMaterial({
        color: 0x65ddff,
        emissive: 0x0b4b66,
        emissiveIntensity: 0.32,
        metalness: 0.12,
        roughness: 0.38,
      }),
    );
    marker.position.y = 1.35;
    marker.rotation.z = Math.PI / 10;

    group.add(base, marker);
    this.scene.add(group);

    return marker;
  }

  connectResizeObserver() {
    this.windowRef.addEventListener('resize', this.resize);

    if (this.ResizeObserverClass) {
      this.resizeObserver = new this.ResizeObserverClass(this.resize);
      this.resizeObserver.observe(this.container);
    }
  }

  resize() {
    if (this.disposed) {
      return null;
    }

    return resizeRendererToContainer({
      container: this.container,
      camera: this.camera,
      renderer: this.renderer,
      devicePixelRatio: this.windowRef.devicePixelRatio ?? 1,
      maxPixelRatio: RENDER_CONFIG.renderer.maxPixelRatio,
    });
  }

  setAnimationLoop(callback) {
    if (this.animationLoop === callback) {
      return;
    }

    this.renderer.setAnimationLoop(callback);
    this.animationLoop = callback;
  }

  update(deltaSeconds) {
    this.snowArena?.update(deltaSeconds);
    this.iceBeacon.rotation.y +=
      deltaSeconds * RENDER_CONFIG.loop.beaconRotationRadiansPerSecond;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    if (this.renderer) {
      this.setAnimationLoop(null);
    }
    this.resizeObserver?.disconnect();
    this.windowRef?.removeEventListener?.('resize', this.resize);

    const geometries = new Set();
    const materials = new Set();

    this.scene.traverse((object) => {
      if (object.geometry) {
        geometries.add(object.geometry);
      }

      if (Array.isArray(object.material)) {
        for (const material of object.material) {
          materials.add(material);
        }
      } else if (object.material) {
        materials.add(object.material);
      }
    });

    for (const geometry of geometries) {
      geometry.dispose();
    }

    for (const material of materials) {
      material.dispose();
    }

    this.scene.clear();
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
    this.disposed = true;

    return true;
  }
}
