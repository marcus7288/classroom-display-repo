// Netlify Function: GET /.netlify/functions/plan?room=blue
//
// Reads the Schedule/Media/Lessons tabs from the private Google Sheet using
// a service account, and returns clean JSON -- never the raw sheet, never
// secrets. This is the Phase 3 data source (see public/js/config.js
// DATA_SOURCE_MODE and the README for Phases 1/2).
//
// Required environment variables (set in the Netlify UI, never committed):
//   GOOGLE_SERVICE_ACCOUNT_BASE64  - the entire service-account JSON key,
//                                    base64-encoded as one string. Base64 is
//                                    used (rather than pasting the JSON, or
//                                    escaping its \n's) because the private
//                                    key's real newlines are otherwise easy
//                                    to mangle when copy-pasted into an env var.
//   SHEET_ID                       - the spreadsheet ID from its URL.

import { readSheetTabs } from "./lib/sheets.js";
import { rowsToObjects } from "./lib/sanitize.js";

function decodeServiceAccount() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  if (!b64) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_BASE64 env var");
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json);
}

export default async (req) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  try {
    const sheetId = process.env.SHEET_ID;
    if (!sheetId) throw new Error("Missing SHEET_ID env var");

    const credentials = decodeServiceAccount();
    const raw = await readSheetTabs(sheetId, credentials);

    const room = new URL(req.url).searchParams.get("room");
    let schedule = rowsToObjects(raw.schedule);
    if (room) {
      schedule = schedule.filter((r) => (r.Room || "").toLowerCase() === room.toLowerCase());
    }

    const body = {
      updatedAt: new Date().toISOString(),
      schedule,
      media: rowsToObjects(raw.media),
      lessons: rowsToObjects(raw.lessons),
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    // Never leak stack traces or credential contents -- just enough for the
    // front-end's data indicator, and for whoever checks the function logs.
    console.error("[plan function]", err);
    return new Response(JSON.stringify({ error: "plan_fetch_failed", message: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
