// Thin wrapper around the Google Sheets API v4 using a service account.
// Deliberately calls the REST API directly with a fetched access token
// instead of pulling in the full `googleapis` package -- `google-auth-library`
// alone is enough to mint a token, and it keeps the function's dependency
// (and cold-start bundle) small.

import { GoogleAuth } from "google-auth-library";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

let cachedAuth = null;

// credentials: the parsed service-account JSON (see decodeServiceAccount in plan.js).
async function getAccessToken(credentials) {
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  }
  const client = await cachedAuth.getClient();
  const { token } = await client.getAccessToken();
  return token;
}

// Fetches one tab's full contents as a 2D array of strings (row 0 = headers).
async function fetchRange(sheetId, token, range) {
  const url = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Sheets API returned ${res.status} for tab "${range}"`);
  }
  const data = await res.json();
  return data.values || [];
}

// Reads the Schedule, Media, and Lessons tabs in parallel.
export async function readSheetTabs(sheetId, credentials) {
  const token = await getAccessToken(credentials);
  const [schedule, media, lessons] = await Promise.all([
    fetchRange(sheetId, token, "Schedule"),
    fetchRange(sheetId, token, "Media"),
    fetchRange(sheetId, token, "Lessons"),
  ]);
  return { schedule, media, lessons };
}
