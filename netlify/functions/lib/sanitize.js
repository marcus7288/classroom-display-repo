// Converts a raw Sheets API 2D array (row 0 = headers) into an array of
// plain objects, dropping fully-blank rows. This is the only place that
// touches the raw sheet values, so it's also where we make sure nothing but
// plain strings ever leaves the function -- no formulas, no metadata.
export function rowsToObjects(values) {
  if (!values || values.length === 0) return [];
  const [header, ...rest] = values;
  const cleanHeader = header.map((h) => String(h ?? "").trim());
  return rest
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => Object.fromEntries(cleanHeader.map((h, i) => [h, String(row[i] ?? "").trim()])));
}
