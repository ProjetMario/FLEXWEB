export function parseCsv(text: string): Record<string, string>[] {
  if (text.length > 15_000_000) throw Error("Fichier limité à 15 Mo.");
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0];
  const delimiter = first.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"' && !cell && !closed) {
      quoted = true;
      continue;
    }
    if (c === delimiter) {
      row.push(cell);
      cell = "";
      closed = false;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      closed = false;
      continue;
    }
    if (closed && !/\s/.test(c))
      throw Error("CSV invalide : caractère après guillemet.");
    cell += c;
  }
  if (quoted) throw Error("CSV invalide : guillemet non fermé.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map((h) => h.trim().toLowerCase());
  if (!headers?.includes("entreprise") || !headers.includes("url_source"))
    throw Error(
      "Colonnes entreprise et url_source nécessaires. Utilisez le CSV FLEX-WEB.",
    );
  if (new Set(headers).size !== headers.length)
    throw Error("Colonnes dupliquées.");
  if (rows.length > 10000) throw Error("Maximum 10 000 fiches par fichier.");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw Error(`Ligne ${i + 2} : nombre de colonnes incorrect.`);
    return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
  });
}
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
