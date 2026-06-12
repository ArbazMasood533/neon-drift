import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildComposer } from '../fx/post.js';

// Owns all the rendering infrastructure: renderer, scene, camera, lights, fog
// and the post-processing composer. Gameplay code just drops objects into
// `stage.scene` and never touches WebGL directly.
export class Stage {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // the composer does multisampled AA for us
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(
      CONFIG.colors.fog,
      CONFIG.world.fogNear,
      CONFIG.world.fogFar,
    );

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.juice.fovBase,
      window.innerWidth / window.innerHeight,
      0.1,
      2200,
    );
    this.basePos = new THREE.Vector3(0, 6.6, 12);
    this.camera.position.copy(this.basePos);
    this.camera.lookAt(0, 3.4, -34);

    // Lighting is intentionally low — the world is largely emissive, and keeping
    // the lights dim gives the solid obstacles strong contrast so they don't wash
    // out against the grid and sun.
    const hemi = new THREE.HemisphereLight(0xff66cc, 0x100225, 0.4);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0x9ad7ff, 0.55);
    key.position.set(-10, 22, 8);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x00e5ff, 0.8, 60, 2);
    rim.position.set(0, 6, 14);
    this.scene.add(rim);

    this.fx = buildComposer(this.renderer, this.scene, this.camera);
  }

  setFov(fov) {
    if (Math.abs(this.camera.fov - fov) > 0.001) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.fx.setSize(w, h);
  }

  render(dt) {
    this.fx.update(dt);
    this.fx.composer.render();
  }
}
