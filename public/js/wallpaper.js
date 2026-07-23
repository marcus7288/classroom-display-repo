// Calm, slowly crossfading wallpaper -- the default resting screen. Built
// from CSS gradients tinted with the room's accent color so Phase 1 needs no
// image assets; if a Sheet Media row of Type "imageset" is ever wired in for
// a room, swap the gradient functions below for real photo URLs.

const GRADIENTS = [
  (accent) => `radial-gradient(circle at 30% 30%, ${accent}55, #0b0e14 70%)`,
  (accent) => `radial-gradient(circle at 70% 65%, ${accent}66, #10131c 75%)`,
  (accent) => `linear-gradient(135deg, ${accent}44, #0b0e14 80%)`,
  (accent) => `linear-gradient(315deg, ${accent}33, #14161f 65%)`,
];

export class Wallpaper {
  constructor(container, accent, intervalSeconds) {
    this.container = container;
    this.accent = accent;
    this.intervalMs = intervalSeconds * 1000;
    this.layers = [];
    this.index = 0;
    this.timer = null;
  }

  mount() {
    this.container.innerHTML = "";
    for (let i = 0; i < 2; i++) {
      const layer = document.createElement("div");
      layer.className = "wallpaper-layer";
      this.container.appendChild(layer);
      this.layers.push(layer);
    }
    this.show(0);
    this.timer = setInterval(() => this.next(), this.intervalMs);
  }

  show(idx) {
    const bg = GRADIENTS[idx % GRADIENTS.length](this.accent);
    const activeLayer = this.layers[idx % 2];
    const otherLayer = this.layers[(idx + 1) % 2];
    activeLayer.style.background = bg;
    activeLayer.classList.add("is-visible");
    otherLayer.classList.remove("is-visible");
  }

  next() {
    this.index++;
    this.show(this.index);
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.layers = [];
  }
}
