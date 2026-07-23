export function escapeHtml(str) {
  const safe = str === null || str === undefined ? "" : String(str);
  return safe.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function formatClock(now = new Date()) {
  return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
