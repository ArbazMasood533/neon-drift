// Procedural audio — no asset files, everything is synthesised with the Web
// Audio API. A looping minor-key arpeggio with a bassline for that driving
// synthwave feel, plus a few one-shot SFX. The context only wakes up after a
// user gesture, which browsers require anyway.

const A_MINOR = {
  // i - VI - III - VII, the bread-and-butter synthwave progression
  progression: [
    [220.0, 261.63, 329.63], // Am
    [174.61, 220.0, 261.63], // F
    [196.0, 246.94, 329.63], // C/G-ish
    [196.0, 246.94, 392.0],  // G
  ],
  bass: [110.0, 87.31, 98.0, 98.0],
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.enabled = true;
    this.started = false;
    this._step = 0;
    this._nextNoteTime = 0;
    this._timer = null;
    this._intensity = 0;
  }

  // Called on the first real interaction.
  resume() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { this.enabled = false; return; }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);
  }

  toggleMute() {
    this.enabled = !this.enabled;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, this.ctx.currentTime, 0.05);
    }
    return this.enabled;
  }

  startMusic() {
    if (!this.ctx || this.started) return;
    this.started = true;
    this._nextNoteTime = this.ctx.currentTime + 0.08;
    this.musicGain.gain.setTargetAtTime(0.32, this.ctx.currentTime, 0.8);
    const loop = () => {
      if (!this.ctx) return;
      this._scheduler();
      this._timer = setTimeout(loop, 25);
    };
    loop();
  }

  stopMusic() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    this.started = false;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.4);
  }

  // intensity 0..1 nudges tempo + brightness as the run speeds up
  setIntensity(v) {
    this._intensity = Math.max(0, Math.min(1, v));
  }

  _scheduler() {
    const tempo = 132 + this._intensity * 26;       // BPM
    const sixteenth = 60 / tempo / 2;
    while (this._nextNoteTime < this.ctx.currentTime + 0.12) {
      this._scheduleStep(this._step, this._nextNoteTime);
      this._nextNoteTime += sixteenth;
      this._step++;
    }
  }

  _scheduleStep(step, time) {
    const barStep = step % 16;
    const chordIndex = Math.floor((step % 64) / 16);
    const chord = A_MINOR.progression[chordIndex];

    // arpeggio every 16th note
    const note = chord[barStep % chord.length] * (barStep % 8 >= 4 ? 2 : 1);
    this._pluck(note, time, 0.16 + this._intensity * 0.05);

    // bassline on the beat
    if (barStep % 4 === 0) {
      this._bass(A_MINOR.bass[chordIndex], time);
    }
    // soft hat on the offbeat for movement
    if (barStep % 2 === 1) this._hat(time);
  }

  _pluck(freq, time, gain) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = 900 + this._intensity * 2600;
    f.Q.value = 7;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
    o.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(time); o.stop(time + 0.34);
  }

  _bass(freq, time) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.22, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.26);
    o.connect(g); g.connect(this.musicGain);
    o.start(time); o.stop(time + 0.28);
  }

  _hat(time) {
    const buf = this._noiseBuffer();
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    src.buffer = buf;
    f.type = 'highpass';
    f.frequency.value = 7000;
    g.gain.setValueAtTime(0.06, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(time); src.stop(time + 0.06);
  }

  _noiseBuffer() {
    if (this._noise) return this._noise;
    const len = this.ctx.sampleRate * 0.1;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }

  // ---- one-shot SFX ----
  collect() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.22);
  }

  boost() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.32);
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // detuned saws sweeping down + a noise burst = satisfying explosion
    for (let i = 0; i < 3; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(320 - i * 40, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.72);
    }
    const src = this.ctx.createBufferSource();
    const ng = this.ctx.createGain();
    src.buffer = this._noiseBuffer();
    src.loop = true;
    ng.gain.setValueAtTime(0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(ng); ng.connect(this.master);
    src.start(t); src.stop(t + 0.5);
  }
}
