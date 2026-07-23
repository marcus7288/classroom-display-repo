// Flannel-graph lesson viewer: step through a lesson's ordered images with
// on-screen buttons or the remote's left/right + Enter/Back. No autoplay --
// a volunteer or the kids advance it by hand.

import { escapeHtml } from "./util.js";

export class LessonViewer {
  constructor(container, items, { onClose }) {
    this.container = container;
    this.items = items; // pre-filtered to one LessonName, sorted by Order
    this.index = 0;
    this.onClose = onClose;
    this.render();
  }

  render() {
    const total = this.items.length;
    const item = this.items[this.index];
    const atStart = this.index === 0;
    const atEnd = this.index === total - 1;

    this.container.innerHTML = `
      <div class="lesson-viewer">
        <button class="lesson-close-btn" data-action="close">&larr; Back</button>
        <div class="lesson-position">${this.index + 1} / ${total}</div>
        <button class="lesson-nav-btn prev" data-action="prev" aria-label="Previous image" ${atStart ? "disabled" : ""}>&#9664;</button>
        <div class="lesson-image-wrap">
          <img src="${item.ImageURL}" alt="${escapeHtml(item.Caption)}" />
        </div>
        <button class="lesson-nav-btn next" data-action="next" aria-label="Next image" ${atEnd ? "disabled" : ""}>&#9654;</button>
        <div class="lesson-caption">${escapeHtml(item.Caption)}</div>
      </div>
    `;

    this.container.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => this.handleAction(btn.dataset.action));
    });

    const preferredFocus =
      this.container.querySelector(".lesson-nav-btn.next:not([disabled])") ||
      this.container.querySelector(".lesson-close-btn");
    preferredFocus?.focus();
  }

  handleAction(action) {
    if (action === "prev") this.prev();
    else if (action === "next") this.next();
    else if (action === "close") this.close();
  }

  prev() {
    if (this.index > 0) {
      this.index--;
      this.render();
    }
  }

  next() {
    if (this.index < this.items.length - 1) {
      this.index++;
      this.render();
    }
  }

  close() {
    this.onClose?.();
  }

  // Returns true if it consumed the key (so app.js's global handler stops there).
  handleKey(e) {
    if (e.key === "ArrowLeft") {
      this.prev();
    } else if (e.key === "ArrowRight") {
      this.next();
    } else if (e.key === "Escape" || e.key === "Backspace" || e.key === "BrowserBack") {
      this.close();
    } else {
      return false;
    }
    e.preventDefault();
    return true;
  }
}
