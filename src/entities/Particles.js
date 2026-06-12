import * as THREE from 'three';
import { PARTICLE_VERT, PARTICLE_FRAG } from '../fx/shaders.js';
import { randRange, TAU } from '../utils/math.js';

// A single pooled point cloud drives every particle in the game: the engine
// trail, pickup sparkles and the death explosion. Each particle is simulated
// on the CPU (there aren't many) and written into shared buffers once a frame.
const MAX = 1400;

export class Particles {
  constructor(scene) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);

    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));

    this.mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // parallel simulation state
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this._cursor = 0;
    this._tmp = new THREE.Color();
  }

  _spawn(x, y, z, vx, vy, vz, life, size, color, drag) {
    const i = this._cursor;
    this._cursor = (this._cursor + 1) % MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this._tmp.set(color);
    this.col[i * 3] = this._tmp.r; this.col[i * 3 + 1] = this._tmp.g; this.col[i * 3 + 2] = this._tmp.b;
    this.life[i] = life; this.maxLife[i] = life;
    this.size[i] = size;
    this.drag[i] = drag;
    this.alpha[i] = 1;
  }

  // Continuous thruster flame behind the ship.
  trail(x, y, z, color, speed) {
    const n = 2;
    for (let k = 0; k < n; k++) {
      this._spawn(
        x + randRange(-0.25, 0.25),
        y + randRange(-0.2, 0.2),
        z + randRange(0, 0.6),
        randRange(-1.5, 1.5),
        randRange(-1.5, 1.5),
        randRange(6, 12) + speed * 0.15,
        randRange(0.25, 0.5),
        randRange(2.4, 4.2),
        color,
        2.5,
      );
    }
  }

  // Burst used for both pickups (small) and the crash (big).
  burst(x, y, z, count, color, power) {
    for (let k = 0; k < count; k++) {
      const theta = Math.random() * TAU;
      const phi = Math.acos(randRange(-1, 1));
      const s = randRange(0.4, 1) * power;
      this._spawn(
        x, y, z,
        Math.sin(phi) * Math.cos(theta) * s,
        Math.sin(phi) * Math.sin(theta) * s + power * 0.3,
        Math.cos(phi) * s,
        randRange(0.5, 1.2),
        randRange(3, 6.5),
        color,
        1.4,
      );
    }
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] *= d;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.max(0, this.life[i] / this.maxLife[i]);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }
}
