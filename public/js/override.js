// Manual scene override, remembered per room in localStorage. Auto-clears
// on a new calendar day (daily rollover) so a Saturday override never
// carries into Sunday; the idle-based reset lives in app.js (it needs the
// live IdleTracker, not just the stored timestamp).

import { CONFIG } from "./config.js";

function key(room) {
  return `${CONFIG.OVERRIDE_KEY_PREFIX}${room}`;
}

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD, local-enough for daily rollover
}

export function setOverride(room, sceneId, now = new Date()) {
  const value = { scene: sceneId, day: todayKey(now) };
  try {
    localStorage.setItem(key(room), JSON.stringify(value));
  } catch {
    // ignore storage failures; override just won't persist across reloads
  }
  return value;
}

export function clearOverride(room) {
  try {
    localStorage.removeItem(key(room));
  } catch {
    // ignore
  }
}

// Returns the active scene id, or null if there is no override or it has
// rolled over to a new day.
export function getOverride(room, now = new Date()) {
  try {
    const raw = localStorage.getItem(key(room));
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value.day !== todayKey(now)) {
      clearOverride(room);
      return null;
    }
    return value.scene;
  } catch {
    return null;
  }
}
