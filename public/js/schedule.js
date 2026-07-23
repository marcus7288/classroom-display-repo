// Turns a room's Schedule rows + the current local time into "what should be
// showing right now" and "what's next". Scheduling is intentionally based on
// the TV's own local clock/timezone -- see README for why each TV must have
// its timezone set correctly.

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// rows: already-validated Schedule rows for a single room, any order.
// now: a Date (injectable for testing).
// Returns { current, next } where each is a schedule row or null.
// - current is the last row whose StartTime <= now (today). If now is
//   earlier than every row's StartTime, current is null (-> wallpaper).
// - next is the first row whose StartTime > now, or null if none remain today.
export function getCurrentAndNext(rows, now = new Date()) {
  const sorted = [...rows].sort((a, b) => toMinutes(a.StartTime) - toMinutes(b.StartTime));
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let current = null;
  let next = null;
  for (const row of sorted) {
    const rowMin = toMinutes(row.StartTime);
    if (rowMin <= nowMin) {
      current = row;
    } else {
      next = row;
      break;
    }
  }
  return { current, next };
}

// Milliseconds until the next row's StartTime (today), or null if there
// isn't one -- used to schedule a precise re-check instead of only polling.
export function msUntil(row, now = new Date()) {
  if (!row) return null;
  const target = new Date(now);
  const [h, m] = row.StartTime.split(":").map(Number);
  target.setHours(h, m, 0, 0);
  const diff = target - now;
  return diff > 0 ? diff : null;
}
