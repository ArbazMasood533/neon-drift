// Small math helpers used across the game. Nothing exotic, but having frame-rate
// independent damping in one place keeps motion consistent everywhere.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const lerp = (a, b, t) => a + (b - a) * t;

export const invLerp = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));

export const remap = (v, a, b, c, d) => lerp(c, d, invLerp(a, b, v));

export const randRange = (a, b) => a + Math.random() * (b - a);

export const randInt = (a, b) => Math.floor(randRange(a, b + 1));

export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// Exponential smoothing that doesn't blow up when the frame time varies.
// lambda is roughly "how many e-folds per second" of convergence.
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const TAU = Math.PI * 2;
