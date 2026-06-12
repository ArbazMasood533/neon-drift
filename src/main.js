import { Game } from './core/Game.js';

// Boot. Guard against the (rare) no-WebGL2 case so users get a message instead
// of a blank screen, then run a clamped fixed-ish loop.
const canvas = document.getElementById('game');

let game;
try {
  game = new Game(canvas);
  game.start();
} catch (err) {
  console.error(err);
  document.getElementById('fallback').classList.remove('hidden');
  document.getElementById('title').classList.add('hidden');
}

if (game) {
  let last = performance.now();

  const frame = (now) => {
    // clamp dt so a tab-switch or GC pause can't teleport the ship
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  window.addEventListener('resize', () => game.onResize());

  // reset the clock when returning to the tab so we don't get one huge frame
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) last = performance.now();
  });

  // M toggles audio
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') {
      const on = game.toggleMute();
      document.getElementById('mute').textContent = on ? '♪ SOUND ON  [M]' : '♪ SOUND OFF [M]';
    }
  });
}
