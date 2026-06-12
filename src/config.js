// Central tuning for the whole game. Keeping every magic number here makes the
// thing feel like a single coherent machine instead of values scattered around.

export const CONFIG = {
  world: {
    laneHalfWidth: 16,     // ship can travel +/- this on X
    floorWidth: 420,
    floorDepth: 1600,
    spawnZ: -360,          // where rows/orbs appear (far ahead)
    recycleZ: 26,          // once something passes this Z it's behind us -> reuse
    fogNear: 70,
    fogFar: 360,
  },

  player: {
    y: 2.4,
    lateralLambda: 7.5,    // how snappy the steering damping is
    maxBank: 0.85,         // radians of roll at full steer
    verticalRange: 1.4,    // small up/down freedom
    radius: 1.6,
  },

  speed: {
    start: 62,
    max: 178,
    accel: 2.0,            // units/sec added each second
    boostMul: 1.55,
    scoreRate: 0.85,       // distance -> score multiplier
  },

  rows: {
    gap: 30,               // Z distance between obstacle rows
    lanes: 5,              // discrete lanes obstacles snap to
    pillarW: 3.4,
    pillarD: 5.0,
    pillarH: 22,
  },

  orbs: {
    value: 125,
    collectRadius: 2.3,
    spawnChance: 0.7,      // chance an open lane gets an orb on a row
  },

  juice: {
    shakeDecay: 1.8,
    hitTrauma: 0.9,
    fovBase: 74,
    fovSpeedGain: 16,      // extra FOV from min->max speed
    aberrationBase: 0.0016,
  },

  colors: {
    bgTop: 0x070014,
    bgHorizon: 0x3a0d5e,
    fog: 0x1b0738,
    gridNear: 0x00e5ff,    // cyan
    gridFar: 0xff2e88,     // magenta
    sunTop: 0xffe66e,
    sunBot: 0xff2e88,
    neon: [0x00e5ff, 0xff2e88, 0xb24bf3, 0x4dff9e],
    orb: 0xfff39a,
    trail: 0x59f8ff,
  },
};
