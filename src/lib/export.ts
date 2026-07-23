import * as XLSX from "xlsx";
import type { CellValue, ColumnDefinition } from "@/lib/columns";
import { formatCellValue } from "@/lib/columns";

export type ExportFormat = "csv" | "xlsx";

interface ExportableRow {
  values: Record<string, CellValue>;
}

/**
 * Build a worksheet-friendly array of records preserving column order and
 * headers. Numeric/boolean values stay native so Excel keeps their types;
 * currencies/dates are emitted as their display strings for portability.
 */
function toRecords(columns: ColumnDefinition[], rows: ExportableRow[]) {
  return rows.map((row) => {
    const record: Record<string, string | number | boolean | null> = {};
    for (const col of columns) {
      const value = row.values[col.key] ?? null;
      if (col.type === "NUMBER" || col.type === "BOOLEAN") {
        record[col.name] = value as number | boolean | null;
      } else {
        record[col.name] = value == null ? "" : formatCellValue(col, value);
      }
    }
    return record;
  });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const safeName = (name: string) =>
  name.replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "_") || "spreadsheet";

export function exportSpreadsheet(
  name: string,
  columns: ColumnDefinition[],
  rows: ExportableRow[],
  format: ExportFormat,
) {
  const visible = columns.filter((c) => !c.hidden).sort((a, b) => a.position - b.position);
  const records = toRecords(visible, rows);
  const headers = visible.map((c) => c.name);
  const worksheet = XLSX.utils.json_to_sheet(records, { header: headers });

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${safeName(name)}.csv`);
    return;
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  download(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${safeName(name)}.xlsx`,
  );
}
