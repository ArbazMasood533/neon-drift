import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, invLerp, lerp, randRange } from '../utils/math.js';
import { Stage } from './Stage.js';
import { Input } from './Input.js';
import { Audio } from './Audio.js';
import { World } from '../entities/World.js';
import { Player } from '../entities/Player.js';
import { Particles } from '../entities/Particles.js';
import { HUD } from '../ui/HUD.js';

const C = CONFIG;
const BEST_KEY = 'neon-drift-best';

// The conductor. Holds the state machine (menu -> playing -> dying -> dead),
// owns every subsystem and wires their events together. Nothing else in the
// codebase knows about game flow.
export class Game {
  constructor(canvas) {
    this.stage = new Stage(canvas);
    this.world = new World(this.stage.scene);
    this.particles = new Particles(this.stage.scene);
    this.player = new Player(this.stage.scene);
    this.input = new Input();
    this.audio = new Audio();
    this.hud = new HUD();

    this.state = 'menu';
    this.time = 0;
    this.score = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.combo = 0;
    this.comboTimer = 0;
    this.speed = C.speed.start;
    this.trauma = 0;
    this.deathTimer = 0;
    this.newBest = false;

    this.handlers = {
      onHit: (x, y, z, color) => this.die(x, y, z, color),
      onCollect: (x, y, z) => this.collect(x, y, z),
    };

    this.input.onStart(() => this.handleStart());

    // a colour we can recolour for the death burst
    this._lastHitColor = new THREE.Color();
  }

  start() {
    this.hud.showTitle(this.best);
    this.player.reset();
  }

  handleStart() {
    this.audio.resume();
    if (this.state === 'menu' || this.state === 'dead') this.begin();
  }

  begin() {
    this.world.reset();
    this.player.reset();
    this.particles.update(0);
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.speed = C.speed.start;
    this.trauma = 0;
    this.newBest = false;
    this.state = 'playing';
    this.hud.showGame();
    this.audio.startMusic();
  }

  collect(x, y, z) {
    this.combo = Math.min(this.combo + 1, 99);
    this.comboTimer = 2.6;
    this.score += C.orbs.value * this.combo;
    this.particles.burst(x, y, z, 26, C.colors.orb, 9);
    this.audio.collect();
    this.stage.fx.kickAberration(0.006);
    this.trauma = Math.min(1, this.trauma + 0.12);
    this.hud.comboPop();
  }

  die(x, y, z, color) {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    this.deathTimer = 1.35;
    this.player.hide();

    // explosion: a dense burst in the impact colour plus white-hot sparks
    this.particles.burst(x, y, z, 240, color, 30);
    this.particles.burst(x, y, z, 80, 0xffffff, 18);
    this.audio.crash();
    this.audio.stopMusic();
    this.trauma = 1;
    this.stage.fx.kickAberration(0.024);
    this.hud.flashHit();

    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      localStorage.setItem(BEST_KEY, String(Math.floor(this.best)));
    }
  }

  update(dt) {
    this.time += dt;
    this._step(dt);
    this._updateCamera(dt);
    this.stage.render(dt);
  }

  _step(dt) {
    switch (this.state) {
      case 'menu': {
        this.world.update(dt, 46, this.player, this.handlers, false);
        const tail = this.player.update(dt, this.input, this.time);
        this.particles.trail(tail.x, tail.y, tail.z, C.colors.trail, 46);
        break;
      }

      case 'playing': {
        const boost = this.input.isBoost();
        this.speed = Math.min(C.speed.max, this.speed + C.speed.accel * dt);
        const effective = this.speed * (boost ? C.speed.boostMul : 1);

        this.world.update(dt, effective, this.player, this.handlers, true);
        if (this.state !== 'playing') break; // a hit happened mid-update

        const tail = this.player.update(dt, this.input, this.time);
        this.particles.trail(tail.x, tail.y, tail.z, boost ? 0xffffff : C.colors.trail, effective);

        this.score += effective * dt * C.speed.scoreRate;
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;

        const difficulty = clamp(invLerp(C.speed.start, C.speed.max, this.speed), 0, 1);
        this.audio.setIntensity(difficulty);

        this.hud.updateHUD({
          score: this.score,
          speed: effective,
          combo: this.combo,
          best: Math.max(this.best, this.score),
        });
        break;
      }

      case 'dying': {
        // slow-mo so the explosion gets its moment
        this.world.update(dt * 0.4, this.speed * 0.4, this.player, this.handlers, false);
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) {
          this.state = 'dead';
          this.hud.showGameOver(this.score, this.best, this.newBest);
        }
        break;
      }

      case 'dead': {
        this.world.update(dt, 30, this.player, this.handlers, false);
        break;
      }
    }

    this.particles.update(dt);
  }

  _updateCamera(dt) {
    const cam = this.stage.camera;

    // shake from trauma (squared so it falls off nicely)
    this.trauma = Math.max(0, this.trauma - C.juice.shakeDecay * dt);
    const shake = this.trauma * this.trauma;
    const ox = randRange(-1, 1) * shake * 1.6;
    const oy = randRange(-1, 1) * shake * 1.2;
    const oz = randRange(-1, 1) * shake * 0.8;

    let followX = 0;
    let lookX = 0;
    if (this.state === 'menu') {
      followX = Math.sin(this.time * 0.3) * 1.4;
      lookX = Math.sin(this.time * 0.3) * 0.6;
    } else {
      followX = this.player.group.position.x * 0.32;
      lookX = this.player.group.position.x * 0.16;
    }

    cam.position.set(followX + ox, 6.6 + oy, 12 + oz);
    cam.lookAt(lookX, 3.4, -34);
    cam.rotateZ(randRange(-1, 1) * shake * 0.06);

    // FOV widens with speed (and a touch more when boosting) for a sense of rush
    let fov = C.juice.fovBase;
    if (this.state === 'playing') {
      const difficulty = clamp(invLerp(C.speed.start, C.speed.max, this.speed), 0, 1);
      fov += difficulty * C.juice.fovSpeedGain;
      if (this.input.isBoost()) fov += 7;
    }
    this.stage.setFov(lerp(cam.fov, fov, Math.min(1, dt * 4)));
  }

  onResize() {
    this.stage.resize();
  }

  toggleMute() {
    return this.audio.toggleMute();
  }
}
