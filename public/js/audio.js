// Handles both real media (an <audio> element playing a URL from the Sheet)
// and the built-in placeholder soundscape: short, gentle tones generated with
// the Web Audio API so Phase 1 needs zero shipped audio files. Real media
// always wins when a Media row has a URL; otherwise we synthesize a tone
// matching the scene "kind" (arrival/story/play/cleanup).
//
// Autoplay note: browsers (and most kiosk browsers) block audio until a user
// gesture. Call unlock() from the Start-splash button's click/keydown handler.

// Each scene "kind" gets a small fixed melodic pattern. `cleanup` is
// intentionally identical every time (per spec: same clean-up track always,
// for Pre-K consistency) -- it never varies by room or Sheet content.
const TONE_PATTERNS = {
  arrival: { loopSec: 6, notes: [
    { t: 0, f: 523.25, d: 0.4 },
    { t: 0.4, f: 659.25, d: 0.4 },
    { t: 0.8, f: 783.99, d: 0.6 },
  ] },
  story: { loopSec: 8, notes: [
    { t: 0, f: 392.0, d: 3.5 },
    { t: 4, f: 329.63, d: 3.5 },
  ] },
  play: { loopSec: 2.4, notes: [
    { t: 0, f: 659.25, d: 0.18, type: "triangle" },
    { t: 0.6, f: 783.99, d: 0.18, type: "triangle" },
    { t: 1.2, f: 659.25, d: 0.18, type: "triangle" },
    { t: 1.8, f: 987.77, d: 0.18, type: "triangle" },
  ] },
  cleanup: { loopSec: 8, notes: [
    { t: 0, f: 523.25, d: 0.35 },
    { t: 0.4, f: 523.25, d: 0.35 },
    { t: 0.8, f: 587.33, d: 0.35 },
    { t: 1.2, f: 659.25, d: 0.7 },
  ] },
};

export class AudioController {
  constructor(initialVolume = 0.6) {
    this.ctx = null;
    this.masterGain = null;
    this.toneInterval = null;
    this.volume = initialVolume;
    this.paused = false;

    this.el = new Audio();
    this.el.loop = true;
    this.el.volume = this.volume;
  }

  // Must be called from within a user-gesture event handler (e.g. the Start
  // splash button) so the browser allows audio to start this session.
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  ensureMasterGain() {
    if (!this.masterGain && this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.masterGain;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.el.volume = this.volume;
    if (this.masterGain && !this.paused) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.25, this.ctx.currentTime, 0.2);
    }
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.el.src) {
      if (this.paused) this.el.pause();
      else this.el.play().catch(() => {});
    } else if (this.masterGain) {
      const target = this.paused ? 0 : this.volume * 0.25;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
    }
  }

  // media: validated Media row ({Name, Type, URL_or_Album, LoopYN}) or null/undefined.
  // kind: scene id, used to select a tone pattern when there's no real URL.
  play(media, kind) {
    this.stop();
    this.paused = false;

    if (media && media.URL_or_Album) {
      this.el.src = media.URL_or_Album;
      this.el.loop = media.LoopYN !== false;
      this.el.volume = this.volume;
      this.el.play().catch((err) => console.warn("[audio] play blocked:", err.message));
      return;
    }

    if (this.ctx) this.playTone(kind);
  }

  playTone(kind) {
    const pattern = TONE_PATTERNS[kind] || TONE_PATTERNS.story;
    const gain = this.ensureMasterGain();
    gain.gain.cancelScheduledValues(this.ctx.currentTime);
    gain.gain.setTargetAtTime(this.volume * 0.25, this.ctx.currentTime, 0.3);

    const scheduleCycle = () => {
      const base = this.ctx.currentTime + 0.02;
      for (const note of pattern.notes) {
        this.playNote(note.f, base + note.t, note.d, note.type || "sine", gain);
      }
    };
    scheduleCycle();
    this.toneInterval = setInterval(scheduleCycle, pattern.loopSec * 1000);
  }

  playNote(freq, startAt, dur, type, destination) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.value = 0;
    osc.connect(env).connect(destination);
    env.gain.setValueAtTime(0, startAt);
    env.gain.linearRampToValueAtTime(1, startAt + Math.min(0.05, dur / 4));
    env.gain.linearRampToValueAtTime(0, startAt + dur);
    osc.start(startAt);
    osc.stop(startAt + dur + 0.05);
  }

  stop() {
    this.el.pause();
    this.el.removeAttribute("src");
    this.el.load();
    if (this.toneInterval) {
      clearInterval(this.toneInterval);
      this.toneInterval = null;
    }
    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }
}
