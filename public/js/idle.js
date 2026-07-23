// Tracks time since the last remote/keyboard input, used to auto-resume the
// schedule after a manual override is forgotten (see override.js/app.js).

export class IdleTracker {
  constructor() {
    this.lastActivity = Date.now();
    const mark = () => {
      this.lastActivity = Date.now();
    };
    // keydown covers TV remote D-pad (mapped to arrow keys/Enter by the
    // kiosk browser); pointerdown covers touch-capable displays/testing.
    window.addEventListener("keydown", mark, { passive: true });
    window.addEventListener("pointerdown", mark, { passive: true });
  }

  idleMs() {
    return Date.now() - this.lastActivity;
  }
}
