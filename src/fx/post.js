import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { POST_VERT, POST_FRAG } from './shaders.js';
import { CONFIG } from '../config.js';

// Builds the full screen pipeline:
//   scene -> HDR bloom -> CRT post (aberration/grain/vignette) -> tone-map.
// Rendered into a multisampled half-float target so we get clean edges AND
// real HDR for the bloom to chew on.
export function buildComposer(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: 4,
  });

  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.95, // strength
    0.65, // radius
    0.18, // threshold — only the bright neon blooms
  );
  composer.addPass(bloom);

  const post = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uAberration: { value: CONFIG.juice.aberrationBase },
      uVignette: { value: 1 },
      uResolution: { value: new THREE.Vector2(size.x, size.y) },
    },
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
  });
  composer.addPass(post);

  composer.addPass(new OutputPass());

  let time = 0;
  let aberration = CONFIG.juice.aberrationBase;
  let aberrationTarget = CONFIG.juice.aberrationBase;

  return {
    composer,
    bloom,
    // Punch the chromatic aberration up briefly (impacts, pickups, boost).
    kickAberration(v) {
      aberrationTarget = Math.max(aberrationTarget, v);
    },
    update(dt) {
      time += dt;
      // ease the aberration back to baseline after a kick
      aberrationTarget += (CONFIG.juice.aberrationBase - aberrationTarget) * Math.min(1, dt * 4);
      aberration += (aberrationTarget - aberration) * Math.min(1, dt * 18);
      post.uniforms.uTime.value = time;
      post.uniforms.uAberration.value = aberration;
    },
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
      post.uniforms.uResolution.value.set(w, h);
    },
  };
}
