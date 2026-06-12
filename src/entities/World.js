import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  GRID_VERT, GRID_FRAG, SUN_VERT, SUN_FRAG, SKY_VERT, SKY_FRAG,
} from '../fx/shaders.js';
import { clamp, invLerp, randRange, randInt, pick } from '../utils/math.js';

const C = CONFIG;

// Everything you actually see in the world: the gradient sky, starfield, retro
// sun, skyline silhouette, the infinite grid, and the pooled obstacles + orbs.
// Obstacles are generated one row at a time and always leave a passable lane,
// so the run is hard but never unfair.
export class World {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.scroll = 0;
    this.distSinceRow = 0;

    this._buildSky();
    this._buildStars();
    this._buildSun();
    this._buildSkyline();
    this._buildGrid();
    this._buildPillars();
    this._buildOrbs();
  }

  // --- static scenery -------------------------------------------------------
  _buildSky() {
    const geo = new THREE.SphereGeometry(1400, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(C.colors.bgTop) },
        uHorizon: { value: new THREE.Color(C.colors.bgHorizon) },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
  }

  _buildStars() {
    const count = 900;
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // upper hemisphere dome only
      const r = randRange(500, 1200);
      const theta = randRange(0, Math.PI * 2);
      const phi = randRange(0.05, 0.85) * Math.PI * 0.5;
      pos[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
      pos[i * 3 + 1] = Math.cos(phi) * r + 60;
      pos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r - 300;
      size[i] = randRange(1, 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.PointsMaterial({
      color: 0xfff0ff, size: 2.2, sizeAttenuation: false,
      transparent: true, opacity: 0.9, fog: false, depthWrite: false,
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.renderOrder = -9;
    this.scene.add(this.stars);
  }

  _buildSun() {
    const geo = new THREE.CircleGeometry(150, 64);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(C.colors.sunTop) },
        uBot: { value: new THREE.Color(C.colors.sunBot) },
      },
      vertexShader: SUN_VERT,
      fragmentShader: SUN_FRAG,
    });
    this.sun = new THREE.Mesh(geo, mat);
    this.sun.position.set(0, 52, -900);
    this.sun.renderOrder = -8;
    this.scene.add(this.sun);
  }

  // jagged wireframe mountain silhouette sitting on the horizon
  _buildSkyline() {
    const segs = 60;
    const span = 1300;
    const pts = [];
    let h = 0;
    for (let i = 0; i <= segs; i++) {
      const x = -span / 2 + (i / segs) * span;
      h = clamp(h + randRange(-26, 26), 4, 120);
      pts.push(new THREE.Vector3(x, h, -780));
      pts.push(new THREE.Vector3(x, 0, -780));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0x6a1f8f, transparent: true, opacity: 0.55, fog: false,
    });
    this.skyline = new THREE.LineSegments(geo, mat);
    this.skyline.renderOrder = -7;
    this.scene.add(this.skyline);
  }

  _buildGrid() {
    const geo = new THREE.PlaneGeometry(C.world.floorWidth, C.world.floorDepth, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.gridMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: {
        uScroll: { value: 0 },
        uNear: { value: new THREE.Color(C.colors.gridNear) },
        uFar: { value: new THREE.Color(C.colors.gridFar) },
        uFadeNear: { value: C.world.fogNear * 0.5 },
        uFadeFar: { value: C.world.fogFar },
        uPulse: { value: 0 },
      },
      vertexShader: GRID_VERT,
      fragmentShader: GRID_FRAG,
    });
    this.grid = new THREE.Mesh(geo, this.gridMat);
    this.grid.position.set(0, 0, -C.world.floorDepth / 2 + 40);
    this.scene.add(this.grid);
  }

  // --- pooled gameplay objects ---------------------------------------------
  _buildPillars() {
    this.pillars = [];
    const box = new THREE.BoxGeometry(C.rows.pillarW, C.rows.pillarH, C.rows.pillarD);
    const edges = new THREE.EdgesGeometry(box);
    for (let i = 0; i < 64; i++) {
      const g = new THREE.Group();
      const fillMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff, transparent: true, opacity: 0.12, depthWrite: false,
      });
      const wireMat = new THREE.LineBasicMaterial({ color: 0x00e5ff });
      const fill = new THREE.Mesh(box, fillMat);
      const wire = new THREE.LineSegments(edges, wireMat);
      g.add(fill, wire);
      g.visible = false;
      g.userData = { active: false, z: 0, x: 0, fillMat, wireMat };
      this.scene.add(g);
      this.pillars.push(g);
    }
    this._pillarCursor = 0;
  }

  _buildOrbs() {
    this.orbs = [];
    const core = new THREE.IcosahedronGeometry(0.72, 0);
    const halo = new THREE.IcosahedronGeometry(1.15, 0);
    for (let i = 0; i < 22; i++) {
      const g = new THREE.Group();
      const coreMesh = new THREE.Mesh(core, new THREE.MeshBasicMaterial({ color: C.colors.orb }));
      const haloMesh = new THREE.Mesh(halo, new THREE.MeshBasicMaterial({
        color: C.colors.orb, transparent: true, opacity: 0.18, depthWrite: false,
      }));
      g.add(coreMesh, haloMesh);
      g.visible = false;
      g.userData = { active: false, z: 0, x: 0, spin: randRange(0.5, 1.5) };
      this.scene.add(g);
      this.orbs.push(g);
    }
    this._orbCursor = 0;
  }

  laneX(i) {
    const lanes = C.rows.lanes;
    return -C.world.laneHalfWidth + (i / (lanes - 1)) * 2 * C.world.laneHalfWidth;
  }

  _nextPillar() {
    const p = this.pillars[this._pillarCursor];
    this._pillarCursor = (this._pillarCursor + 1) % this.pillars.length;
    return p;
  }

  _nextOrb() {
    const o = this.orbs[this._orbCursor];
    this._orbCursor = (this._orbCursor + 1) % this.orbs.length;
    return o;
  }

  // Lay down one row of obstacles plus a possible orb. `difficulty` is 0..1.
  _spawnRow(difficulty) {
    const lanes = C.rows.lanes;
    const blocked = clamp(1 + Math.floor(difficulty * 3), 1, lanes - 1);

    // pick which lanes are blocked
    const order = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, blocked);
    const blockedSet = new Set(order);

    for (const lane of order) {
      const p = this._nextPillar();
      const color = pick(C.colors.neon);
      p.userData.fillMat.color.setHex(color);
      p.userData.wireMat.color.setHex(color);
      const x = this.laneX(lane);
      p.position.set(x, C.rows.pillarH / 2, C.world.spawnZ);
      p.userData.active = true;
      p.userData.x = x;
      p.userData.z = C.world.spawnZ;
      p.visible = true;
    }

    // drop an orb in an open lane sometimes, biased toward the open path
    if (Math.random() < C.orbs.spawnChance) {
      const open = [0, 1, 2, 3, 4].filter((l) => !blockedSet.has(l));
      if (open.length) {
        const lane = pick(open);
        const o = this._nextOrb();
        const x = this.laneX(lane);
        o.position.set(x, C.player.y + randRange(-0.4, 0.8), C.world.spawnZ);
        o.userData.active = true;
        o.userData.x = x;
        o.userData.z = C.world.spawnZ;
        o.visible = true;
      }
    }
  }

  reset() {
    for (const p of this.pillars) { p.userData.active = false; p.visible = false; p.userData.z = 999; }
    for (const o of this.orbs) { o.userData.active = false; o.visible = false; o.userData.z = 999; }
    this.distSinceRow = 0;
  }

  // dt: delta seconds, speed: world speed, player: Player, handlers: {onHit, onCollect},
  // collisions: when false (menu) we still animate but ignore impacts.
  update(dt, speed, player, handlers, collisions = true) {
    this.time += dt;
    this.scroll += speed * dt;
    this.gridMat.uniforms.uScroll.value = this.scroll;
    this.gridMat.uniforms.uPulse.value = Math.sin(this.time * 3.0) * 0.5 + 0.5;

    // spawn rows by distance travelled so spacing is speed-independent
    const difficulty = clamp(invLerp(C.speed.start, C.speed.max, speed), 0, 1);
    this.distSinceRow += speed * dt;
    while (this.distSinceRow >= C.rows.gap) {
      this.distSinceRow -= C.rows.gap;
      this._spawnRow(difficulty);
    }

    const col = player.collider();

    // obstacles
    for (const p of this.pillars) {
      if (!p.userData.active) continue;
      p.userData.z += speed * dt;
      p.position.z = p.userData.z;
      if (p.userData.z > C.world.recycleZ) {
        p.userData.active = false;
        p.visible = false;
        continue;
      }
      if (collisions && player.alive) {
        const dz = Math.abs(p.userData.z - col.z);
        const dx = Math.abs(p.userData.x - col.x);
        if (dz < C.rows.pillarD / 2 + col.r && dx < C.rows.pillarW / 2 + col.r) {
          handlers.onHit(p.userData.x, C.player.y, p.userData.z, p.userData.wireMat.color.getHex());
          return;
        }
      }
    }

    // orbs
    for (const o of this.orbs) {
      if (!o.userData.active) continue;
      o.userData.z += speed * dt;
      o.position.z = o.userData.z;
      o.rotation.y += dt * o.userData.spin * 2;
      o.rotation.x += dt * o.userData.spin;
      o.position.y = C.player.y + Math.sin(this.time * 3 + o.userData.x) * 0.25;
      if (o.userData.z > C.world.recycleZ) {
        o.userData.active = false;
        o.visible = false;
        continue;
      }
      if (collisions && player.alive) {
        const dz = Math.abs(o.userData.z - col.z);
        const dx = Math.abs(o.userData.x - col.x);
        const dy = Math.abs(o.position.y - col.y);
        if (dz < C.orbs.collectRadius && dx < C.orbs.collectRadius && dy < C.orbs.collectRadius + 0.6) {
          o.userData.active = false;
          o.visible = false;
          handlers.onCollect(o.userData.x, o.position.y, o.userData.z);
        }
      }
    }
  }
}
