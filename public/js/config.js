// Central configuration for Classroom Display.
// Editing this file requires a redeploy (it's code, not content) -- see README
// for the difference between "code changes" (this file) and "content changes"
// (the Google Sheet, which needs no redeploy).

// Rooms are chosen via ?room=<key>. Each has a display label and a CSS accent
// color used to theme the display (applied as a body class, see style.css).
export const ROOMS = {
  blue: { key: "blue", label: "Blue Room", accent: "#2f6fed" },
  green: { key: "green", label: "Green Room", accent: "#2fa84f" },
  yellow: { key: "yellow", label: "Yellow Room", accent: "#d69b12" },
};

// Canonical scene IDs. Use these everywhere in code and in the Sheet's
// `Scene` column -- never the display labels below.
export const SCENE_IDS = ["wallpaper", "arrival", "story", "play", "cleanup", "lesson"];

// Display labels for the UI only.
export const SCENE_LABELS = {
  wallpaper: "Wallpaper",
  arrival: "Arrival",
  story: "Story Time",
  play: "Play Time",
  cleanup: "Clean-Up",
  lesson: "Lesson",
};

export const CONFIG = {
  // Where the schedule/media/lesson data comes from:
  //   "builtin" - Phase 1: bundled placeholder content, no Sheet needed.
  //   "csv"     - Phase 2: three "published to web" CSV URLs, no service account.
  //   "function"- Phase 3: private Sheet read through the Netlify Function.
  // Changing this is a one-line code change + redeploy, as described in the README.
  DATA_SOURCE_MODE: "builtin",

  // Phase 3: same-origin serverless function (see netlify/functions/plan.js).
  FUNCTION_URL: "/.netlify/functions/plan",

  // Phase 2: paste the "Publish to web" CSV link for each tab here.
  // File > Share > Publish to web > select the tab > Comma-separated values (.csv)
  CSV_URLS: {
    schedule: "",
    media: "",
    lessons: "",
  },

  // How often the display re-fetches the plan from the data source, in minutes.
  FETCH_INTERVAL_MINUTES: 7,

  // A manual override (a volunteer pressing a scene button) automatically
  // reverts to the automatic schedule after this many minutes of no remote
  // input, so a forgotten override never carries into the next class.
  IDLE_RESET_MINUTES: 20,

  // localStorage key prefixes.
  CACHE_KEY_PREFIX: "classroom-display:plan:",
  OVERRIDE_KEY_PREFIX: "classroom-display:override:",

  // Wallpaper slideshow crossfade interval, in seconds.
  WALLPAPER_INTERVAL_SECONDS: 25,
};
