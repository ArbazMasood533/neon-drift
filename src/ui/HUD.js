// Thin wrapper over the DOM overlay. The game calls semantic methods
// (showGame, updateHUD, ...) and never pokes at elements directly.
export class HUD {
  constructor() {
    this.elScore = document.getElementById('score');
    this.elBest = document.getElementById('best');
    this.elSpeed = document.getElementById('speed');
    this.elCombo = document.getElementById('combo');

    this.hud = document.getElementById('hud');
    this.title = document.getElementById('title');
    this.gameover = document.getElementById('gameover');
    this.finalScore = document.getElementById('final-score');
    this.finalBest = document.getElementById('final-best');
    this.newBest = document.getElementById('new-best');
    this.titleBest = document.getElementById('title-best');
    this.flash = document.getElementById('hit-flash');
  }

  _fmt(n) {
    return Math.floor(n).toLocaleString('en-US');
  }

  showTitle(best) {
    this.titleBest.textContent = best > 0 ? `BEST  ${this._fmt(best)}` : '';
    this.title.classList.remove('hidden');
    this.gameover.classList.add('hidden');
    this.hud.classList.add('hidden');
  }

  showGame() {
    this.title.classList.add('hidden');
    this.gameover.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  showGameOver(score, best, isNewBest) {
    this.finalScore.textContent = this._fmt(score);
    this.finalBest.textContent = `BEST  ${this._fmt(best)}`;
    this.newBest.classList.toggle('hidden', !isNewBest);
    this.gameover.classList.remove('hidden');
    this.hud.classList.add('hidden');
  }

  updateHUD({ score, speed, combo, best }) {
    this.elScore.textContent = this._fmt(score);
    this.elBest.textContent = this._fmt(best);
    this.elSpeed.textContent = Math.round(speed);
    if (combo > 1) {
      this.elCombo.textContent = `x${combo}`;
      this.elCombo.classList.remove('hidden');
    } else {
      this.elCombo.classList.add('hidden');
    }
  }

  comboPop() {
    if (!this.elCombo) return;
    this.elCombo.classList.remove('pop');
    // force reflow so the animation can retrigger
    void this.elCombo.offsetWidth;
    this.elCombo.classList.add('pop');
  }

  flashHit() {
    if (!this.flash) return;
    this.flash.classList.remove('show');
    void this.flash.offsetWidth;
    this.flash.classList.add('show');
  }
}
