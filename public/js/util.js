export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function formatClock(now = new Date()) {
  return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
