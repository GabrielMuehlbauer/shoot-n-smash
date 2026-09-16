import {
  ACESFilmicToneMapping,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { loadFinalTextureSet } from '../assets/final-assets.js';
import { RENDER_CONFIG } from '../config/render-config.js';
import { SNOW_ARENA_CONFIG } from '../config/snow-arena-config.js';
import { resizeRendererToContainer } from '../utils/viewport.js';
import { SnowArena } from '../world/SnowArena.js';
import { disposeScenario, loadIceScenario } from '../world/IceScenario.js';

export class RenderContext {
  constructor(
    container,
    {
      windowRef = window,
      ResizeObserverClass = globalThis.ResizeObserver,
      textureLoader = globalThis.document ? new TextureLoader() : null,
      scenarioLoader = globalThis.document ? new GLTFLoader() : null,
    } = {},
  ) {
    if (!container?.append) {
      throw new Error('RenderContext requer um contêiner HTML válido.');
    }

    this.container = container;
    this.windowRef = windowRef;
    this.ResizeObserverClass = ResizeObserverClass;
    this.textureLoader = textureLoader;
    this.scenarioLoader = scenarioLoader;
    this.finalTextures = null;
    this.assetStatus = textureLoader ? 'loading' : 'fallback';
    this.assetLoadId = 0;
    this.disposed = false;
    this.animationLoop = null;

    this.resize = this.resize.bind(this);

    this.scene = new Scene();
    this.scene.background = new Color(RENDER_CONFIG.renderer.clearColor);

    this.camera = this.createCamera();

    try {
      this.renderer = this.createRenderer();
      this.configureXR();
      this.container.append(this.renderer.domElement);

      this.createLights();
      this.createGround();
      this.loadFinalAssets();
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
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.setClearColor(RENDER_CONFIG.renderer.clearColor);
    renderer.domElement.dataset.gameCanvas = 'true';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute(
      'aria-label',
      'Arena 3D de neve com mira, disparos e inimigos hostis que avançam até o jogador.',
    );

    return renderer;
  }

  createLights() {
    const hemisphereLight = new HemisphereLight(0xdff0ff, 0x344666, 1.2);
    const directionalLight = new DirectionalLight(0xfff2e5, 2.0);
    directionalLight.position.set(-30, 45, 20);

    this.scene.add(hemisphereLight, directionalLight);
  }

  configureXR() {
    if (!this.renderer.xr) {
      return false;
    }

    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType?.(
      RENDER_CONFIG.xr?.referenceSpaceType ?? 'local-floor',
    );
    return true;
  }

  get isXRPresenting() {
    return Boolean(this.renderer?.xr?.isPresenting);
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
    group.position.set(-8.8, 0, -10.4);

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
      new ConeGeometry(0.62, 2.3, 5),
      new MeshStandardMaterial({
        color: 0x65ddff,
        emissive: 0x0b4b66,
        emissiveIntensity: 0.32,
        metalness: 0.12,
        roughness: 0.38,
      }),
    );
    marker.position.y = 1.48;
    marker.rotation.z = Math.PI / 10;

    group.add(base, marker);
    this.scene.add(group);

    return marker;
  }

  loadFinalAssets() {
    if (this.scenarioLoader) {
      const loadId = ++this.assetLoadId;
      this.assetStatus = 'loading';
      this.assetLoadPromise = loadIceScenario({
        loader: this.scenarioLoader,
        textureLoader: this.textureLoader,
      })
        .then((scenario) => {
          if (this.disposed || loadId !== this.assetLoadId) {
            disposeScenario(scenario);
            return false;
          }
          // Keep the animated snowfall while replacing the old procedural ground.
          const oldArena = this.snowArena;
          const snowfall = oldArena.snowfall;
          snowfall.removeFromParent();
          scenario.add(snowfall);
          scenario.update = (delta) => {
            snowfall.rotation.y += Math.max(0, Number(delta) || 0)
              * SNOW_ARENA_CONFIG.snowfall.rotationRadiansPerSecond;
          };
          oldArena.removeFromParent();
          disposeScenario(oldArena);
          this.snowArena = scenario;
          this.scene.add(scenario);
          if (this.iceBeacon?.parent) this.iceBeacon.parent.visible = false;
          this.scene.background = new Color(0xb7cbea);
          this.scene.fog = new Fog(0xb7cbea, 100, 350);
          this.camera.far = 500;
          this.camera.updateProjectionMatrix();
          this.assetStatus = 'ready';
          this.renderer.domElement.dataset.scenario = 'ice-scenario';
          return true;
        })
        .catch((error) => {
          if (!this.disposed && loadId === this.assetLoadId) {
            this.assetStatus = 'error';
            this.assetError = error;
          }
          return false;
        });
      return this.assetLoadPromise;
    }

    if (!this.textureLoader) {
      return false;
    }

    const loadId = ++this.assetLoadId;
    const maximumAnisotropy =
      this.renderer.capabilities?.getMaxAnisotropy?.() ?? 1;
    this.assetStatus = 'loading';
    this.assetLoadPromise = loadFinalTextureSet({
      textureLoader: this.textureLoader,
      maximumAnisotropy,
    })
      .then((textures) => {
        if (this.disposed || loadId !== this.assetLoadId) {
          for (const texture of Object.values(textures)) {
            texture.dispose?.();
          }
          return false;
        }

        try {
          this.snowArena.applyTextures(textures);
        } catch (error) {
          for (const texture of Object.values(textures)) {
            texture.dispose?.();
          }
          throw error;
        }

        this.finalTextures = textures;
        this.assetStatus = 'ready';
        return true;
      })
      .catch(() => {
        if (!this.disposed && loadId === this.assetLoadId) {
          this.assetStatus = 'error';
        }
        return false;
      });

    return this.assetLoadPromise;
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
    this.assetLoadId += 1;

    for (const texture of Object.values(this.finalTextures ?? {})) {
      texture.dispose?.();
    }
    this.finalTextures = null;

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
