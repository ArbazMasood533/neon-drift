import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp, lerp } from '../utils/math.js';

// The player's hover-ship. Built from primitives at runtime (no external model)
// so the whole game stays in one repo with zero asset downloads. Handles its
// own steering feel: damped lateral motion, roll into turns, a little hover
// bob, and a thruster anchor the particle system reads from.
export class Player {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, CONFIG.player.y, 0);
    this._buildMesh();
    scene.add(this.group);

    this.targetX = 0;
    this.targetY = 0;
    this.bob = 0;
    this.alive = true;
    this._tail = new THREE.Vector3();
  }

  _buildMesh() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a16,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x120024,
    });
    const neonMat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.gridNear });
    const accentMat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.gridFar });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x8af6ff });

    // fuselage — a tapered hex prism pointing forward (-Z)
    const fuselage = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.6, 6), bodyMat);
    fuselage.rotation.x = -Math.PI / 2;
    fuselage.scale.set(1, 0.55, 1);
    this.group.add(fuselage);

    // glowing edge wire so it reads against the dark world
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.ConeGeometry(1.12, 4.62, 6)),
      new THREE.LineBasicMaterial({ color: CONFIG.colors.gridNear }),
    );
    wire.rotation.x = -Math.PI / 2;
    wire.scale.set(1, 0.55, 1);
    this.group.add(wire);

    // cockpit
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), glassMat);
    cockpit.position.set(0, 0.32, -0.4);
    cockpit.scale.set(1, 0.7, 1.4);
    this.group.add(cockpit);

    // wings
    const wingGeo = new THREE.BoxGeometry(2.6, 0.12, 1.5);
    const wingL = new THREE.Mesh(wingGeo, bodyMat);
    wingL.position.set(-1.7, -0.05, 0.7);
    wingL.rotation.z = 0.28;
    const wingR = wingL.clone();
    wingR.position.x = 1.7;
    wingR.rotation.z = -0.28;
    this.group.add(wingL, wingR);

    // wingtip lights
    const tipGeo = new THREE.BoxGeometry(0.4, 0.18, 0.5);
    const tipL = new THREE.Mesh(tipGeo, accentMat);
    tipL.position.set(-2.9, 0.05, 0.7);
    const tipR = new THREE.Mesh(tipGeo, neonMat);
    tipR.position.set(2.9, 0.05, 0.7);
    this.group.add(tipL, tipR);

    // engine block + glow at the tail
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.8, 12), bodyMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(0, 0, 2.0);
    this.group.add(engine);
    this.engineGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 16),
      new THREE.MeshBasicMaterial({ color: CONFIG.colors.trail }),
    );
    this.engineGlow.position.set(0, 0, 2.42);
    this.engineGlow.rotation.y = Math.PI;
    this.group.add(this.engineGlow);

    // light that travels with the ship to catch the grid below
    this.light = new THREE.PointLight(CONFIG.colors.trail, 2.2, 26, 2);
    this.light.position.set(0, 0.5, 1.5);
    this.group.add(this.light);
  }

  reset() {
    this.group.position.set(0, CONFIG.player.y, 0);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
    this.targetX = 0;
    this.targetY = 0;
    this.alive = true;
  }

  update(dt, input, time) {
    const steer = input.steer();
    const vert = input.vertical();

    // lateral target inside the lane; vertical has a small range
    this.targetX = clamp(steer * CONFIG.world.laneHalfWidth, -CONFIG.world.laneHalfWidth, CONFIG.world.laneHalfWidth);
    this.targetY = clamp(this.targetY + vert * dt * 6, -CONFIG.player.verticalRange, CONFIG.player.verticalRange);

    const p = this.group.position;
    const prevX = p.x;
    p.x = damp(p.x, this.targetX, CONFIG.player.lateralLambda, dt);

    // hover bob so it never feels static
    this.bob += dt;
    const bobY = Math.sin(this.bob * 2.4) * 0.18;
    p.y = damp(p.y, CONFIG.player.y + this.targetY + bobY, 6, dt);

    // bank into the turn based on how fast we're actually moving sideways
    const lateralVel = (p.x - prevX) / Math.max(dt, 1e-4);
    const roll = clamp(-lateralVel * 0.05, -CONFIG.player.maxBank, CONFIG.player.maxBank);
    this.group.rotation.z = lerp(this.group.rotation.z, roll, Math.min(1, dt * 10));
    this.group.rotation.y = lerp(this.group.rotation.y, -steer * 0.25, Math.min(1, dt * 8));
    this.group.rotation.x = lerp(this.group.rotation.x, -vert * 0.12 + Math.sin(time * 1.7) * 0.02, Math.min(1, dt * 6));

    // pulse the engine glow
    const pulse = 0.85 + Math.sin(time * 22) * 0.15;
    this.engineGlow.scale.setScalar(pulse);
    this.light.intensity = 2.0 + Math.sin(time * 18) * 0.4;

    // world-space tail position for the trail emitter
    this._tail.set(p.x, p.y, p.z + 2.6);
    return this._tail;
  }

  collider() {
    return {
      x: this.group.position.x,
      y: this.group.position.y,
      z: this.group.position.z,
      r: CONFIG.player.radius,
    };
  }

  hide() {
    this.group.visible = false;
    this.alive = false;
  }
}
