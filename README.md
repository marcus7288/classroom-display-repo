# Classroom Display

A full-screen wall display for Pre-K classroom TVs (Blue / Green / Yellow
rooms). It shows the right "scene" — Wallpaper, Arrival, Story Time, Play
Time, Clean-Up, or a flannel-graph Lesson — automatically, based on a
schedule ministry staff maintain in a Google Sheet. A volunteer can override
it at any time with big remote-friendly buttons.

No build step, no framework, no npm dependencies on the front end. It's
plain HTML/CSS/JS (ES modules), so a Netlify deploy is just a file upload —
seconds, not minutes. The only piece with a dependency is the one serverless
function that reads the private Sheet, and its install is isolated from the
front-end deploy.

## How it's built, and why

| Layer | What | Why |
|---|---|---|
| `public/` | Static HTML/CSS/JS, no bundler | Instant Netlify deploys; nothing to compile or break |
| `netlify/functions/plan.js` | One serverless function | Only piece that needs a private credential (Sheets service account) |
| Google Sheet | `Schedule` / `Media` / `Lessons` tabs | The admin UI — staff edit it directly, no custom CMS |

Content changes (editing the Sheet) need **zero deploys** — the display
re-fetches on a timer. Only code changes (this repo) trigger a Netlify
deploy, and since there's no build, that's fast too.

## Three phases

The app is designed to be useful at every stage:

1. **Phase 1 — live in minutes.** Deploy the static site as-is. It ships
   with built-in placeholder content (no Sheet, no Google Cloud needed) so
   all three room URLs work immediately.
2. **Phase 2 — quick content.** Publish the Sheet's three tabs to the web as
   CSV and point `public/js/config.js` at them. No service account, no
   Google Cloud project. Fast, but the published tabs are technically
   readable by anyone with the link.
3. **Phase 3 — private.** Switch to the Netlify Function, which reads the
   Sheet privately via a service account. Same front-end; only the data
   source changes (one line in `config.js`).

Switch phases by editing `DATA_SOURCE_MODE` in `public/js/config.js`:

```js
DATA_SOURCE_MODE: "builtin", // "builtin" | "csv" | "function"
```

That's a code change (needs a redeploy), unlike the Sheet content itself.

---

## Repo layout

```
public/                    Static site (Netlify "publish" directory)
  index.html
  css/style.css
  js/
    config.js               Rooms, scene IDs/labels, data-source config
    app.js                  Bootstraps everything, keyboard/remote handling
    dataSource.js           Fetches plan (builtin/csv/function) + localStorage cache
    csv.js                  Tiny CSV parser for the Phase-2 path
    validate.js             Sanitizes/filters rows from the Sheet
    schedule.js             "What scene is it right now?" logic
    scenes.js               Renders the current scene
    wallpaper.js             Crossfading resting-screen background
    lessons.js               Flannel-graph lesson viewer
    audio.js                 Real media playback + generated placeholder tones
    override.js               Manual-override state (localStorage, per room)
    idle.js                   Tracks input for idle-based auto-resume
    placeholder.js             Built-in Phase-1 / offline-fallback content
    util.js
  assets/lessons/*.svg        Sample flannel-graph images (Noah's Ark)
netlify/
  functions/
    plan.js                   The one serverless function (Phase 3)
    lib/sheets.js              Google Sheets API access via service account
    lib/sanitize.js            Raw sheet rows -> plain JSON objects
    package.json                Function-only dependency (google-auth-library)
netlify.toml                  publish="public", functions dir, no build command
sheet-template/                Starter CSVs matching the Sheet tab spec
```

---

## 1. Google Cloud setup (for Phase 3)

You only need this for the private, service-account-backed path. Skip it
entirely for Phases 1–2.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) while
   signed in as `classroom@centralassembly.org` (or an admin who can share
   with that account) and create a new project (e.g. "Classroom Display").
2. **Enable the Google Sheets API**: APIs & Services → Library → search
   "Google Sheets API" → Enable.
3. **Create a service account**: APIs & Services → Credentials → Create
   Credentials → Service account. Give it any name (e.g.
   `classroom-display-reader`); it doesn't need any project-level role.
4. Open the new service account → Keys → Add Key → Create new key → JSON.
   This downloads a `.json` file — **treat it like a password.**
5. **Base64-encode the entire JSON file** into one string:
   ```bash
   base64 -i service-account.json | tr -d '\n' > service-account.b64.txt
   ```
   (The private key inside that JSON contains real newlines, which are
   notorious for getting mangled when pasted into a plain env var or
   escaped as `\n`. Base64-encoding the whole file sidesteps that — the
   function decodes it back to JSON at runtime. See `netlify/functions/plan.js`.)
6. **Share the Google Sheet** with the service account's email address
   (looks like `classroom-display-reader@your-project.iam.gserviceaccount.com`,
   found in the JSON's `client_email` field) as **Viewer**. The Sheet itself
   stays private to everyone else.

## 2. Netlify environment variables

In the Netlify site's dashboard: **Site configuration → Environment
variables**, add:

| Key | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_BASE64` | the contents of `service-account.b64.txt` from step 5 above |
| `SHEET_ID` | the spreadsheet ID from its URL: `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit` |

Never commit either value to the repo. `.gitignore` already excludes
`.env*` files if you use one for local testing.

Redeploy (or trigger a new deploy) after adding/changing env vars so the
function picks them up.

## 3. The Google Sheet template

Create a Sheet with exactly these three tabs (see `sheet-template/*.csv` for
importable starter data — File → Import → Insert new sheet(s), once per tab).

### `Schedule`
| Column | Meaning |
|---|---|
| `Room` | `blue`, `green`, or `yellow` |
| `StartTime` | 24-hour `HH:MM`, e.g. `09:15` |
| `Scene` | one of the canonical IDs: `wallpaper`, `arrival`, `story`, `play`, `cleanup`, `lesson` |
| `MediaRef` | optional; matches `Media.Name` (for audio) or `Lessons.LessonName` (when `Scene = lesson`) |
| `Notes` | free text, for staff only |

The display shows the row with the latest `StartTime` that has already
passed today, and switches automatically at the next row's time. If the
current time is before the first row of the day, it shows Wallpaper. Rows
with a bad time, unknown room, or unrecognized scene are skipped (and a
small, non-alarming indicator appears on screen so staff notice).

### `Media`
| Column | Meaning |
|---|---|
| `Name` | matched by `Schedule.MediaRef` |
| `Type` | `audio`, `video`, or `imageset` |
| `URL_or_Album` | direct media URL. Leave blank for audio to use a built-in generated placeholder tone |
| `LoopYN` | `Y`/`N` — loop the track (music for story/play/cleanup should loop) |
| `Notes` | free text |

By design, **Clean-Up always plays the same track** — keep one row named
"Clean-Up Song" and reference it from every room's `cleanup` schedule row,
for consistency the kids recognize.

### `Lessons`
| Column | Meaning |
|---|---|
| `LessonName` | groups rows into one flannel-graph set; matched by `Schedule.MediaRef` when `Scene = lesson` |
| `Order` | integer; images are shown in ascending order |
| `ImageURL` | direct image URL (required — rows without one are skipped) |
| `Caption` | short caption shown under the image |

**Join keys, spelled out:** `Schedule.MediaRef → Media.Name` for anything
that plays audio, and `Schedule.MediaRef → Lessons.LessonName` specifically
when `Schedule.Scene = lesson`.

### Editing experience for staff

No code, no admin panel — just spreadsheet editing:
- To change what plays when, edit a `StartTime` or `Scene` cell.
- To add a new lesson, add rows to `Lessons` with a new `LessonName`, then
  reference that name from a `Schedule` row with `Scene = lesson`.
- Typos are safe: a bad row is silently skipped rather than breaking the
  display, so half-finished edits won't blank a TV mid-class.
- Changes appear on screen within `FETCH_INTERVAL_MINUTES` (default 7) —
  no redeploy, no waiting on a developer.

## 4. Media hosting

- **Images and short audio**: put them in this repo's `public/assets/`
  folder and reference them by site-relative URL
  (`https://YOUR-SITE.netlify.app/assets/...`) — the most reliable option
  for a kiosk browser, since it's the same origin, no auth, no rate limits.
- **Larger files**: host in Google Drive/Photos on `classroom@centralassembly.org`,
  shared "Anyone with the link."
  - **Drive direct-link caveat**: a normal Drive share link
    (`.../file/d/FILE_ID/view`) opens Drive's viewer, not the raw file, and
    will not play directly in an `<audio>`/`<img>` tag. Convert it to a
    direct-download form, e.g.
    `https://drive.google.com/uc?export=download&id=FILE_ID`. This still
    isn't as reliable as first-party hosting for continuous video streaming.
  - **For video specifically**, prefer an **unlisted YouTube link** (embed)
    or a dedicated storage bucket (e.g. Netlify itself, S3, Cloudinary) —
    both stream far more reliably to a TV than Drive.

## 5. TV / kiosk setup

Each TV needs a kiosk-mode browser pointed at its room URL:

1. Install **TV Bro** (free, open-source) or **Fully Kiosk Browser** from
   the Google Play Store on the Google TV device.
2. Set the **start URL** / **kiosk URL** to the room's address, e.g.
   `https://YOUR-SITE.netlify.app/?room=blue`.
3. Enable **auto-start on boot** so the display recovers from a power
   cycle unattended.
4. Enable the browser's own **"keep screen on"** setting — this is the
   primary way the display stays awake. The app also calls the Wake Lock
   API as a best-effort backup where the browser supports it, but don't
   rely on it alone.
5. **Set the correct timezone on the device.** Scheduling uses the TV's
   local clock — if a TV's timezone/clock is wrong, its automatic scene
   switching will be wrong too.
6. **Autoplay**: most kiosk browsers block audio until a user gesture. The
   app shows a one-tap "Press Enter to Start" splash on load specifically
   to satisfy this with a single remote press. Some kiosk browsers have
   their *own* autoplay-blocking setting that can suppress audio even after
   that tap — check the browser's site/media settings if a room stays
   silent.
7. Confirm the D-pad reaches every control: arrow keys move focus around
   the control bar and the lesson viewer, Enter/OK activates a focused
   button, and Back closes the lesson viewer (or is otherwise swallowed) —
   it's mapped so it can never navigate the kiosk browser away from the app.

## 6. Phase 2: published-CSV alternative

If you want the Sheet driving the display today without setting up Google
Cloud:

1. In Google Sheets: **File → Share → Publish to web**.
2. Under "Link", choose the specific tab (not "Entire document") and select
   **Comma-separated values (.csv)**. Do this once per tab (`Schedule`,
   `Media`, `Lessons`) — you'll get three separate URLs.
3. Paste the three URLs into `public/js/config.js`:
   ```js
   CSV_URLS: {
     schedule: "https://docs.google.com/.../pub?gid=0&single=true&output=csv",
     media: "https://docs.google.com/.../pub?gid=123&single=true&output=csv",
     lessons: "https://docs.google.com/.../pub?gid=456&single=true&output=csv",
   },
   ```
4. Set `DATA_SOURCE_MODE: "csv"` in the same file, commit, and push.

**Trade-off**: a published tab is readable by anyone with its URL — fine
for a non-sensitive class schedule, not appropriate if the Sheet ever holds
anything sensitive. Move to Phase 3 (the Function) when that matters.

---

## Local development

There's no build step, so any static file server works:

```bash
cd public
python3 -m http.server 8080
# then open http://localhost:8080/?room=blue
```

To test the Netlify Function locally, use the [Netlify CLI](https://docs.netlify.com/cli/get-started/):

```bash
npm install -g netlify-cli
netlify dev
```

## Deploying

1. Push to `main` — Netlify's continuous deployment picks it up
   automatically (no build command; it just publishes `public/`).
2. For the Function, make sure `GOOGLE_SERVICE_ACCOUNT_BASE64` and
   `SHEET_ID` are set in the Netlify site's environment variables (see
   section 2) before switching `DATA_SOURCE_MODE` to `"function"`.

## Acceptance checklist

- [x] Phase 1 deploys with no build command; all three room URLs render at 1920×1080.
- [x] Keyboard-only navigation (arrows + Enter, Back to close) reaches every control with a visible focus ring.
- [x] The function returns valid JSON; a forced fetch failure still shows the cached/placeholder plan.
- [x] Malformed Sheet rows are skipped without crashing.
- [x] A manual override auto-resets to the schedule after idle/day rollover.
- [x] No secrets in the repo; secrets only live in Netlify env vars.

## Extending this

The maintainer is expected to extend this, so a few notes on where things
live:

- Add a new scene: give it a canonical ID in `config.js` (`SCENE_IDS`/`SCENE_LABELS`),
  handle it in `scenes.js`'s `render()`, and add rows for it in the Sheet.
- Swap the wallpaper's gradients for real photos: `wallpaper.js`'s `GRADIENTS`
  array is the only place that needs to change (feed it Sheet-driven
  `imageset` URLs instead if you want that data-driven).
- Change idle/day reset behavior: `CONFIG.IDLE_RESET_MINUTES` in `config.js`;
  the daily-rollover logic is in `override.js`.
- The whole app is ~10 small ES modules with no bundler; open any file in
  `public/js/` and it's the actual code that runs in the browser, unmodified.
