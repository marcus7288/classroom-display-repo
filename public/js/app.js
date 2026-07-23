// Classroom Display bootstrap. Wires together: room selection, the Start
// splash (unlocks audio for the session), data loading (with offline
// fallback), the schedule engine, manual override, and remote/keyboard
// navigation. Kept as one file since the app is small; each concern it
// delegates to lives in its own module (schedule.js, scenes.js, audio.js...).

import { CONFIG, ROOMS, SCENE_IDS, SCENE_LABELS } from "./config.js";
import { fetchPlan } from "./dataSource.js";
import { getCurrentAndNext } from "./schedule.js";
import { getOverride, setOverride, clearOverride } from "./override.js";
import { IdleTracker } from "./idle.js";
import { AudioController } from "./audio.js";
import { SceneManager } from "./scenes.js";
import { formatClock } from "./util.js";

const els = {
  roomPicker: document.getElementById("room-picker"),
  roomPickerList: document.getElementById("room-picker-list"),
  startSplash: document.getElementById("start-splash"),
  startBtn: document.getElementById("start-btn"),
  stage: document.getElementById("stage"),
  sceneRoot: document.getElementById("scene-root"),
  hud: document.getElementById("hud"),
  clock: document.getElementById("clock"),
  nextUp: document.getElementById("next-up"),
  dataIndicator: document.getElementById("data-indicator"),
  controlBar: document.getElementById("control-bar"),
  sceneButtons: document.getElementById("scene-buttons"),
  resumeBtn: document.getElementById("resume-btn"),
};

function getRoomFromUrl() {
  const key = new URLSearchParams(location.search).get("room");
  return key && ROOMS[key] ? ROOMS[key] : null;
}

function showRoomPicker() {
  els.roomPicker.hidden = false;
  els.roomPickerList.innerHTML = Object.values(ROOMS)
    .map(
      (r) =>
        `<a class="room-btn" style="--room-color:${r.accent}" href="?room=${r.key}">${r.label}</a>`
    )
    .join("");
}

// ---- Everything below only runs once a valid room is known ----

function main(room) {
  document.body.classList.add(`room-${room.key}`);
  document.documentElement.style.setProperty("--accent", room.accent);

  const idle = new IdleTracker();
  const audio = new AudioController();
  const scenes = new SceneManager(els.sceneRoot, audio);

  let plan = { schedule: [], media: [], lessons: [] };
  let lastRenderKey = null;

  buildControlBar(room, () => forceTick());

  // The Start button has `autofocus` in the HTML, but #start-splash starts
  // out `hidden` -- autofocus only applies while an element is visible
  // during initial page load, so it never actually takes focus once we
  // un-hide the splash here. Without an explicit focus() call, a remote
  // with no mouse has nothing to send Enter to, and pressing it does nothing.
  els.startBtn.focus();

  // A focused <button> already activates on Enter/Space natively (fires
  // "click"), so a single click listener is enough -- adding a matching
  // keydown handler here would double-fire, and moving focus to the control
  // bar synchronously within that same keydown risks the browser's native
  // Enter-activation landing on whatever just received focus instead.
  els.startBtn.addEventListener("click", start);

  function start() {
    try {
      audio.unlock();
    } catch (err) {
      console.warn("[audio] unlock failed:", err.message); // don't let this block the splash from dismissing
    }
    requestWakeLock();
    els.startSplash.hidden = true;
    els.stage.hidden = false;
    // Deferred so it can't be swept up in the same key event that
    // triggered this click (see comment above).
    setTimeout(() => els.controlBar.querySelector("button")?.focus(), 0);
    boot();
  }

  async function boot() {
    await refreshPlan();
    tick();
    setInterval(tick, 15000);
    setInterval(refreshPlan, CONFIG.FETCH_INTERVAL_MINUTES * 60000);
  }

  async function refreshPlan() {
    const result = await fetchPlan(room.key);
    plan = result.plan;
    setDataIndicator(result.source !== "live" && CONFIG.DATA_SOURCE_MODE !== "builtin", result.skipped);
    forceTick();
  }

  function setDataIndicator(showStale, skipped) {
    const show = showStale || skipped > 0;
    els.dataIndicator.hidden = !show;
    if (show) {
      els.dataIndicator.textContent = skipped > 0
        ? `⚠ using saved copy, ${skipped} row(s) skipped`
        : "⚠ using saved copy";
    }
  }

  function forceTick() {
    lastRenderKey = null;
    tick();
  }

  function tick(now = new Date()) {
    els.clock.textContent = formatClock(now);

    const roomSchedule = plan.schedule.filter((r) => r.Room === room.key);
    const { current, next } = getCurrentAndNext(roomSchedule, now);

    els.nextUp.textContent = next
      ? `Next: ${SCENE_LABELS[next.Scene] || next.Scene} at ${formatDisplayTime(next.StartTime)}`
      : "";

    const override = getOverride(room.key, now);
    const overrideStillFresh = override && idle.idleMs() < CONFIG.IDLE_RESET_MINUTES * 60000;
    if (override && !overrideStillFresh) {
      clearOverride(room.key);
    }

    const effectiveSceneId = overrideStillFresh ? override : current?.Scene || "wallpaper";
    const mediaRef = resolveMediaRef(roomSchedule, effectiveSceneId, current);
    const mediaRow = plan.media.find((m) => m.Name === mediaRef) || null;
    const lessonName = effectiveSceneId === "lesson" ? resolveLessonName(roomSchedule, plan.lessons, current) : null;

    const renderKey = `${effectiveSceneId}|${lessonName || ""}|${mediaRef || ""}`;
    highlightControls(effectiveSceneId, !!overrideStillFresh);
    els.hud.classList.toggle("is-hidden", effectiveSceneId === "lesson");

    if (renderKey === lastRenderKey) return;
    lastRenderKey = renderKey;

    scenes.render(effectiveSceneId, {
      accent: room.accent,
      media: mediaRow,
      lessons: plan.lessons,
      lessonName,
      onLessonClose: () => {
        // Leaving the flannel-graph viewer returns to a calm wallpaper; it
        // will auto-resume the live schedule after the usual idle timeout.
        setOverride(room.key, "wallpaper");
        forceTick();
      },
    });
  }

  // Global keyboard/remote handling. Never navigates the browser (no history
  // back), so the Back button can't accidentally exit the kiosk view.
  window.addEventListener("keydown", (e) => {
    if (els.stage.hidden) {
      // Start splash is up. A focused Start button already activates via its
      // own click listener (see the focus() call above); this is a fallback
      // for kiosk browsers where programmatic focus doesn't stick, so Enter
      // still works even if nothing is focused.
      if ((e.key === "Enter" || e.key === " ") && document.activeElement !== els.startBtn) {
        e.preventDefault();
        start();
      }
      return;
    }
    if (scenes.handleKey(e)) return; // lesson viewer consumed it

    if (e.key === "Escape" || e.key === "Backspace" || e.key === "BrowserBack") {
      e.preventDefault();
      return; // nothing else to close; swallow so it never triggers browser navigation
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveControlFocus(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      moveControlFocus(1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      moveControlFocus(0);
    }
  });

  function moveControlFocus(direction) {
    const buttons = Array.from(els.controlBar.querySelectorAll("button:not([disabled])"));
    if (buttons.length === 0) return;
    const activeIndex = buttons.indexOf(document.activeElement);
    const nextIndex = activeIndex === -1 ? 0 : (activeIndex + direction + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
  }
}

function resolveMediaRef(roomSchedule, sceneId, currentRow) {
  if (currentRow && currentRow.Scene === sceneId && currentRow.MediaRef) return currentRow.MediaRef;
  const row = roomSchedule.find((r) => r.Scene === sceneId && r.MediaRef);
  return row ? row.MediaRef : null;
}

function resolveLessonName(roomSchedule, lessons, currentRow) {
  if (currentRow && currentRow.Scene === "lesson" && currentRow.MediaRef) return currentRow.MediaRef;
  const row = roomSchedule.find((r) => r.Scene === "lesson" && r.MediaRef);
  if (row) return row.MediaRef;
  return lessons[0]?.LessonName || null;
}

function formatDisplayTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return formatClock(d);
}

function buildControlBar(room, onChange) {
  els.sceneButtons.innerHTML = SCENE_IDS.map(
    (id) => `<button class="control-btn" data-scene="${id}">${SCENE_LABELS[id]}</button>`
  ).join("");

  els.sceneButtons.querySelectorAll("[data-scene]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setOverride(room.key, btn.dataset.scene);
      onChange();
    });
  });

  els.resumeBtn.addEventListener("click", () => {
    clearOverride(room.key);
    onChange();
  });
}

function highlightControls(effectiveSceneId, isOverride) {
  els.sceneButtons.querySelectorAll("[data-scene]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.scene === effectiveSceneId);
  });
  els.resumeBtn.disabled = !isOverride;
  els.resumeBtn.classList.toggle("is-active", isOverride);
}

let wakeLock = null;
async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (err) {
    console.warn("[wakelock]", err.message); // best-effort; kiosk browser's own keep-awake setting is primary
  }
}
document.addEventListener("visibilitychange", () => {
  if (wakeLock !== null && document.visibilityState === "visible") requestWakeLock();
});

// ---- Entry point ----
const room = getRoomFromUrl();
if (!room) {
  showRoomPicker();
} else {
  els.startSplash.hidden = false;
  els.startSplash.querySelector("#start-splash-title").textContent = `${room.label} Display`;
  main(room);
}
