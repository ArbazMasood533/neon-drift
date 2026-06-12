// All GLSL lives here so the JS that wires it up stays readable. These are the
// three pieces that give the game its look: the infinite grid floor, the retro
// sun, and the final CRT-ish post pass.

// ---------------------------------------------------------------------------
// Infinite neon grid. Drawn on a big flat plane; lines are derived from world
// space so they stay crisp at any distance and scroll toward the camera.
// ---------------------------------------------------------------------------
export const GRID_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying float vDist;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

export const GRID_FRAG = /* glsl */ `
  precision highp float;
  uniform float uScroll;
  uniform vec3  uNear;
  uniform vec3  uFar;
  uniform float uFadeNear;
  uniform float uFadeFar;
  uniform float uPulse;
  varying vec3 vWorld;
  varying float vDist;

  // anti-aliased grid using screen-space derivatives
  float gridFactor(vec2 p, float width) {
    vec2 g = abs(fract(p) - 0.5);
    vec2 d = g / fwidth(p);
    float line = min(d.x, d.y);
    return 1.0 - clamp(line - width, 0.0, 1.0);
  }

  void main() {
    // 4-unit cells; subtract scroll so the lines travel toward the viewer
    vec2 coord = vec2(vWorld.x, vWorld.z - uScroll) / 4.0;
    float l = gridFactor(coord, 0.0);

    float depthFade = 1.0 - smoothstep(uFadeNear, uFadeFar, vDist);
    float lateral = clamp(abs(vWorld.x) / 70.0, 0.0, 1.0);
    vec3 col = mix(uNear, uFar, lateral);

    float glow = pow(l, 1.5);
    vec3 outc = col * (l * 1.25 + glow * 0.35);
    outc *= 0.85 + uPulse * 0.15;

    float alpha = l * depthFade;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(outc, alpha);
  }
`;

// ---------------------------------------------------------------------------
// The sun: a vertical gradient disc with the classic horizontal slits across
// its lower half.
// ---------------------------------------------------------------------------
export const SUN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SUN_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uTop;
  uniform vec3 uBot;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p);
    if (d > 0.5) discard;

    float y = vUv.y;
    vec3 col = mix(uBot, uTop, smoothstep(0.0, 1.0, y));

    // slits get fatter toward the bottom of the disc
    float linePos = fract(y * 24.0);
    float gapAmount = smoothstep(0.62, 0.0, y);
    float slit = step(gapAmount, linePos);
    float mask = y > 0.5 ? 1.0 : slit;

    float edge = smoothstep(0.5, 0.47, d);
    gl_FragColor = vec4(col * mask * edge * 0.5, mask * edge);
  }
`;

// ---------------------------------------------------------------------------
// Vertical sky gradient drawn on the inside of a big sphere.
// ---------------------------------------------------------------------------
export const SKY_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SKY_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  varying vec3 vPos;
  void main() {
    float h = normalize(vPos).y;
    float t = smoothstep(-0.05, 0.55, h);
    vec3 col = mix(uHorizon, uTop, t);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Soft additive particle sprites with per-point size and alpha.
// ---------------------------------------------------------------------------
export const PARTICLE_VERT = /* glsl */ `
  attribute float size;
  attribute float alpha;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (320.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

export const PARTICLE_FRAG = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.0, r) * vAlpha;
    gl_FragColor = vec4(vColor, a);
  }
`;

// ---------------------------------------------------------------------------
// Final post pass: chromatic aberration, scanlines, vignette, film grain.
// Runs on the bloomed HDR image right before tone-mapping.
// ---------------------------------------------------------------------------
export const POST_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const POST_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform float uAberration;
  uniform float uVignette;
  uniform vec2  uResolution;
  varying vec2 vUv;

  float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    vec2 dir = uv - 0.5;
    float dist = length(dir);

    // chromatic aberration grows toward the edges and spikes on impact
    float a = uAberration * (0.4 + dist);
    vec3 col;
    col.r = texture2D(tDiffuse, uv - dir * a * 2.2).r;
    col.g = texture2D(tDiffuse, uv).g;
    col.b = texture2D(tDiffuse, uv + dir * a * 2.2).b;

    // scanlines
    float scan = 0.93 + 0.07 * sin(uv.y * uResolution.y * 1.3 + uTime * 6.0);
    col *= scan;

    // vignette
    float vig = smoothstep(0.9, 0.32, dist);
    col *= mix(1.0, vig, uVignette);

    // subtle film grain
    float g = rand(uv * uResolution * 0.6 + fract(uTime));
    col += (g - 0.5) * 0.045;

    gl_FragColor = vec4(col, 1.0);
  }
`;
