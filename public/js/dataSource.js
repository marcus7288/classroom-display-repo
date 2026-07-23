// Fetches the lesson plan (Schedule + Media + Lessons) from whichever source
// CONFIG.DATA_SOURCE_MODE selects, validates it, and caches the last good
// result in localStorage. If a fetch fails for any reason (network hiccup,
// Sheet moved, malformed response), we fall back to the cache, and if there
// is no cache yet, to the built-in placeholder -- the screen never blanks.

import { CONFIG } from "./config.js";
import { parseCSV } from "./csv.js";
import { validatePlan } from "./validate.js";
import { getPlaceholderPlan } from "./placeholder.js";

function cacheKey(room) {
  return `${CONFIG.CACHE_KEY_PREFIX}${room}`;
}

function readCache(room) {
  try {
    const raw = localStorage.getItem(cacheKey(room));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(room, plan) {
  try {
    localStorage.setItem(cacheKey(room), JSON.stringify(plan));
  } catch {
    // localStorage can be full/unavailable in some kiosk browsers; not fatal.
  }
}

async function fetchFromFunction(room) {
  const res = await fetch(`${CONFIG.FUNCTION_URL}?room=${encodeURIComponent(room)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Function returned ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.message || json.error);
  return json;
}

async function fetchFromCSV(room) {
  const { schedule, media, lessons } = CONFIG.CSV_URLS;
  if (!schedule || !media || !lessons) {
    throw new Error("CSV_URLS not configured");
  }
  const [scheduleText, mediaText, lessonsText] = await Promise.all(
    [schedule, media, lessons].map((url) =>
      fetch(url, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`CSV fetch failed: ${r.status}`);
        return r.text();
      })
    )
  );
  const allSchedule = parseCSV(scheduleText);
  return {
    schedule: allSchedule.filter((r) => (r.Room || "").toLowerCase() === room.toLowerCase()),
    media: parseCSV(mediaText),
    lessons: parseCSV(lessonsText),
    updatedAt: new Date().toISOString(),
  };
}

// Returns { plan, source, skipped } where source is one of
// "live" | "cache" | "placeholder", used to drive the small data indicator.
export async function fetchPlan(room) {
  if (CONFIG.DATA_SOURCE_MODE === "builtin") {
    const plan = validatePlan(getPlaceholderPlan(room));
    return { plan, source: "placeholder", skipped: plan.skipped };
  }

  try {
    const raw =
      CONFIG.DATA_SOURCE_MODE === "function"
        ? await fetchFromFunction(room)
        : await fetchFromCSV(room);
    const plan = validatePlan(raw);
    writeCache(room, plan);
    return { plan, source: "live", skipped: plan.skipped };
  } catch (err) {
    console.warn("[classroom-display] plan fetch failed, falling back:", err.message);
    const cached = readCache(room);
    if (cached) {
      return { plan: cached, source: "cache", skipped: cached.skipped || 0 };
    }
    const plan = validatePlan(getPlaceholderPlan(room));
    return { plan, source: "placeholder", skipped: plan.skipped };
  }
}
