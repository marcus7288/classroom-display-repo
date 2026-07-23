// Sanitizes rows coming from the Sheet (via CSV or the Function). Staff edit
// a live spreadsheet, so bad rows (a typo'd time, a half-filled row, a blank
// tab) are expected -- we skip them quietly rather than crash or blank the
// screen. `skipped` counts feed the small on-screen data indicator.

import { SCENE_IDS } from "./config.js";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateSchedule(rows) {
  let skipped = 0;
  const clean = [];
  for (const r of rows || []) {
    const room = (r.Room || "").trim();
    const startTime = (r.StartTime || "").trim();
    const scene = (r.Scene || "").trim().toLowerCase();
    if (!room || !TIME_RE.test(startTime) || !SCENE_IDS.includes(scene)) {
      skipped++;
      continue;
    }
    clean.push({
      Room: room,
      StartTime: startTime,
      Scene: scene,
      MediaRef: (r.MediaRef || "").trim(),
      Notes: (r.Notes || "").trim(),
    });
  }
  return { rows: clean, skipped };
}

export function validateMedia(rows) {
  let skipped = 0;
  const clean = [];
  for (const r of rows || []) {
    const name = (r.Name || "").trim();
    const type = (r.Type || "").trim().toLowerCase();
    if (!name || !["audio", "video", "imageset"].includes(type)) {
      skipped++;
      continue;
    }
    clean.push({
      Name: name,
      Type: type,
      // Optional: a blank URL is valid for audio (the display falls back to a
      // built-in generated tone) but see validateLessons for images, which
      // have no such fallback and are required.
      URL_or_Album: (r.URL_or_Album || "").trim(),
      // Accepts either the raw "Y"/"N" string a Sheet row produces, or a
      // real boolean (the built-in placeholder plan supplies one directly).
      LoopYN: String(r.LoopYN ?? "").trim().toUpperCase() === "Y" || r.LoopYN === true,
      Notes: (r.Notes || "").trim(),
    });
  }
  return { rows: clean, skipped };
}

export function validateLessons(rows) {
  let skipped = 0;
  const clean = [];
  for (const r of rows || []) {
    const lessonName = (r.LessonName || "").trim();
    const order = Number.parseInt(r.Order, 10);
    const imageUrl = (r.ImageURL || "").trim();
    if (!lessonName || !Number.isFinite(order) || !imageUrl) {
      skipped++;
      continue;
    }
    clean.push({
      LessonName: lessonName,
      Order: order,
      ImageURL: imageUrl,
      Caption: (r.Caption || "").trim(),
    });
  }
  clean.sort((a, b) => a.Order - b.Order);
  return { rows: clean, skipped };
}

// Runs all three validators and returns a combined plan + total skipped count.
export function validatePlan(rawPlan) {
  const schedule = validateSchedule(rawPlan.schedule);
  const media = validateMedia(rawPlan.media);
  const lessons = validateLessons(rawPlan.lessons);
  return {
    schedule: schedule.rows,
    media: media.rows,
    lessons: lessons.rows,
    skipped: schedule.skipped + media.skipped + lessons.skipped,
    updatedAt: rawPlan.updatedAt || new Date().toISOString(),
  };
}
