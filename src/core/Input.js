import { clamp } from '../utils/math.js';

// One small abstraction over keyboard, mouse and touch so the rest of the game
// just asks "which way are we steering" without caring about the device.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pointerX = 0;        // -1..1 across the screen
    this.pointerActive = false;
    this.boost = false;
    this._startHandlers = [];
    this._bind();
  }

  onStart(fn) {
    this._startHandlers.push(fn);
  }

  _fireStart() {
    for (const fn of this._startHandlers) fn();
  }

  _bind() {
    this._kd = (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this._fireStart();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.boost = true;
    };
    this._ku = (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.boost = false;
    };
    this._pm = (e) => {
      this.pointerX = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      this.pointerActive = true;
    };
    this._pd = () => this._fireStart();

    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('pointermove', this._pm, { passive: true });
    window.addEventListener('pointerdown', this._pd);
  }

  // -1 (left) .. 1 (right). Keyboard wins over the pointer when a key is held.
  steer() {
    let k = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) k -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) k += 1;
    if (k !== 0) return k;
    if (this.pointerActive) return this.pointerX;
    return 0;
  }

  vertical() {
    let k = 0;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) k += 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) k -= 1;
    return k;
  }

  isBoost() {
    return this.boost;
  }

  dispose() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('pointermove', this._pm);
    window.removeEventListener('pointerdown', this._pd);
  }
}
