<div align="center">

# ◢◤ NEON DRIFT ◢◤

### An endless synthwave hover-racer that runs in your browser.

Outrun an infinite neon grid at rising speed, weave through glowing obstacles,
chain orb pickups for combo multipliers, and try not to lose the signal.

Built from scratch with **Three.js**, **custom GLSL** and a hand-rolled
**HDR post-processing stack** — no game engine, no asset downloads, no build step.

</div>

---

## ✦ Features

- **Real-time 3D** rendered with Three.js (WebGL2)
- **Custom shaders** — the infinite scrolling grid, the slitted retro sun and the
  sky gradient are all written in GLSL
- **HDR post-processing pipeline** — multisampled half-float render target →
  Unreal-style bloom → chromatic aberration + scanlines + vignette + film grain →
  ACES tone-mapping
- **Procedural everything** — the world generates one fair obstacle row at a time
  (there's always a way through), pickups, the ship model and even the **soundtrack**
  are made at runtime. Zero binary assets.
- **Game feel** — damped steering with roll-into-turns, hover bob, speed-scaled FOV,
  trauma-based screen shake, slow-motion death, combo pop-ups and a juicy impact flash
- **GPU-friendly particle engine** driving the thruster trail, pickup sparkles and the
  death explosion from a single pooled point cloud
- **Procedural synthwave audio** — a looping minor-key arpeggio + bassline synthesised
  with the Web Audio API, plus reactive SFX
- Persistent **best score**, fully **responsive**, mouse / keyboard / touch controls

## ✦ Controls

| Action | Keys |
| --- | --- |
| Steer | `A` / `D`, `←` / `→`, or move the mouse |
| Boost | hold `Shift` |
| Start / Retry | `Space`, `Enter` or click |
| Mute | `M` |

## ✦ Run it locally

The game loads Three.js from a CDN via an **import map**, so there's nothing to
install — you only need to serve the folder over HTTP (ES modules don't load from
`file://`).

**Windows:** double-click **`start.bat`**.

**Any platform:**

```bash
# Python (already on most machines)
python -m http.server 5050

# …or Node
npx serve -l 5050 .
```

Then open <http://localhost:5050>.

## ✦ How it's built

The code is deliberately split into small, single-responsibility modules:

```
src/
├── main.js              boot + the clamped game loop
├── config.js            every tunable number in one place
├── core/
│   ├── Game.js          state machine + the conductor that wires it all together
│   ├── Stage.js         renderer, scene, camera, lights, fog, composer
│   ├── Input.js         keyboard / mouse / touch → a single "steer" value
│   └── Audio.js         Web Audio synth: arpeggio, bass, and one-shot SFX
├── entities/
│   ├── Player.js        the ship — built from primitives, banking + trail anchor
│   ├── World.js         grid, sun, skyline, and the pooled obstacle/orb spawner
│   └── Particles.js     one pooled point cloud for trail, sparkles & explosions
├── fx/
│   ├── post.js          builds the EffectComposer pass chain
│   └── shaders.js       all the GLSL (grid, sun, sky, particles, CRT post)
├── ui/
│   └── HUD.js           DOM overlay: score, combo, menus, game-over
└── utils/
    └── math.js          clamp, lerp, frame-rate-independent damping, …
```

A few design notes:

- **Object pooling** everywhere in the hot path — obstacles, orbs and particles are
  allocated once and recycled, so there's no garbage-collector hitching mid-run.
- **Distance-based spawning** keeps obstacle spacing constant no matter how fast you
  go, and each row guarantees at least one open lane so deaths are always your fault 😉.
- **Frame-rate-independent motion** via exponential damping, with the loop's delta
  clamped so a tab-switch can't fling the ship across the map.

## ✦ Tech

`Three.js` · `WebGL2` · `GLSL` · `Web Audio API` · vanilla ES modules — no framework.

## ✦ License

[MIT](LICENSE) — do whatever you like with it.
