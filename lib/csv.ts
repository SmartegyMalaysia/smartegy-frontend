const spreadsheetFormula = /^[\u0000-\u0020]*[=+\-@]/;

export function sanitizeSpreadsheetCell(value: unknown) {
  const text = String(value ?? "");
  return spreadsheetFormula.test(text) ? `'${text}` : text;
}

export function csvCell(value: unknown) {
  return `"${sanitizeSpreadsheetCell(value).replaceAll('"', '""')}"`;
}

export function serializeCsv(rows: unknown[][], lineEnding = "\r\n") {
  return `${rows.map((row) => row.map(csvCell).join(",")).join(lineEnding)}${lineEnding}`;
}
