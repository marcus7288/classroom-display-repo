// Renders the current scene into #scene-root. Delegates to Wallpaper (calm
// crossfading background) and LessonViewer (flannel-graph stepper) for the
// two scenes with dedicated components; the remaining "cue" scenes
// (arrival/story/play/cleanup) share one simple full-bleed title-card layout
// plus looping audio.

import { CONFIG, SCENE_LABELS } from "./config.js";
import { Wallpaper } from "./wallpaper.js";
import { LessonViewer } from "./lessons.js";
import { escapeHtml } from "./util.js";

export class SceneManager {
  constructor(root, audio) {
    this.root = root;
    this.audio = audio;
    this.wallpaper = null;
    this.lessonViewer = null;
  }

  // opts: { accent, media, lessons, lessonName, onLessonClose }
  render(sceneId, opts) {
    this.teardown();

    if (sceneId === "wallpaper") {
      this.renderWallpaper(opts.accent);
    } else if (sceneId === "lesson") {
      this.renderLesson(opts.lessons, opts.lessonName, opts.onLessonClose);
    } else {
      this.renderCue(sceneId, opts.accent, opts.media);
    }
  }

  renderWallpaper(accent) {
    const el = document.createElement("div");
    el.className = "scene is-visible";
    this.root.appendChild(el);
    this.wallpaper = new Wallpaper(el, accent, CONFIG.WALLPAPER_INTERVAL_SECONDS);
    this.wallpaper.mount();
    this.audio.stop();
  }

  renderCue(sceneId, accent, media) {
    const el = document.createElement("div");
    el.className = "scene is-visible";
    el.style.background = `radial-gradient(circle at 50% 30%, ${accent}55, #0b0e14 75%)`;
    const subtitle = media && media.Name ? `<div class="scene-subtitle">${escapeHtml(media.Name)}</div>` : "";
    el.innerHTML = `<div class="scene-title">${escapeHtml(SCENE_LABELS[sceneId] || sceneId)}</div>${subtitle}`;
    this.root.appendChild(el);
    this.audio.play(media, sceneId);
  }

  renderLesson(lessons, lessonName, onClose) {
    const items = (lessons || [])
      .filter((l) => l.LessonName === lessonName)
      .sort((a, b) => a.Order - b.Order);

    const el = document.createElement("div");
    this.root.appendChild(el);
    this.audio.stop();

    if (items.length === 0) {
      el.className = "scene is-visible";
      el.innerHTML = `<div class="scene-title">Lesson</div><div class="scene-subtitle">No lesson content is set for this time.</div>`;
      return;
    }
    this.lessonViewer = new LessonViewer(el, items, { onClose });
  }

  // Forwards a keydown event to the lesson viewer if one is active.
  // Returns true if the event was handled and should not propagate further.
  handleKey(e) {
    if (this.lessonViewer) return this.lessonViewer.handleKey(e);
    return false;
  }

  teardown() {
    if (this.wallpaper) {
      this.wallpaper.destroy();
      this.wallpaper = null;
    }
    this.lessonViewer = null;
    this.root.innerHTML = "";
  }
}
