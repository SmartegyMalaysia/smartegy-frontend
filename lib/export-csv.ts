import { serializeCsv } from "./csv";

export function downloadCsv(fileName: string, rows: Array<Array<string | number>>) {
  const csv = serializeCsv(rows);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}
