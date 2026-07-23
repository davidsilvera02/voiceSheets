import { type ColumnType, parseDate, parseNumeric } from "@/lib/columns";

export interface InferredColumn {
  key: string;
  name: string;
  type: ColumnType;
  options?: string[];
  currency?: string;
}

/** snake_case key from a header, matching the server's key rules; deduped. */
function keyFromName(name: string, used: Set<string>): string {
  let base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^([0-9])/, "col_$1") || "column";
  let key = base;
  let n = 2;
  while (used.has(key)) key = `${base}_${n++}`;
  used.add(key);
  return key;
}

const TRUE_WORDS = ["true", "yes", "y"];
const FALSE_WORDS = ["false", "no", "n"];
const CURRENCY_HINT = /price|cost|amount|total|revenue|salary|balance|fee|budget|\$|usd|eur|mxn/i;

/** Detect a column's type from a sample of its (string) values. */
function detectType(header: string, values: string[]): {
  type: ColumnType;
  options?: string[];
  currency?: string;
} {
  const nonEmpty = values.map((v) => (v ?? "").trim()).filter(Boolean);
  if (nonEmpty.length === 0) return { type: "TEXT" };

  const lower = nonEmpty.map((v) => v.toLowerCase());

  // Boolean: every value is a boolean word, and at least one is a real yes/no.
  const boolSet = new Set([...TRUE_WORDS, ...FALSE_WORDS]);
  if (lower.every((v) => boolSet.has(v)) && lower.some((v) => v === "yes" || v === "no" || v === "true" || v === "false")) {
    return { type: "BOOLEAN" };
  }

  // Number / currency (checked before date so "2024" stays a number).
  if (nonEmpty.every((v) => parseNumeric(v) !== null)) {
    return CURRENCY_HINT.test(header) ? { type: "CURRENCY", currency: "USD" } : { type: "NUMBER" };
  }

  // Date
  if (nonEmpty.every((v) => parseDate(v) !== null)) {
    return { type: "DATE" };
  }

  // Dropdown: a small set of repeated distinct values.
  const distinct = new Map<string, string>(); // lower -> original (first seen)
  for (const v of nonEmpty) if (!distinct.has(v.toLowerCase())) distinct.set(v.toLowerCase(), v);
  if (distinct.size >= 2 && distinct.size <= 8 && nonEmpty.length >= distinct.size * 2) {
    return { type: "DROPDOWN", options: Array.from(distinct.values()) };
  }

  // Text vs. long text.
  const avgLen = nonEmpty.reduce((a, v) => a + v.length, 0) / nonEmpty.length;
  return { type: avgLen > 60 ? "LONG_TEXT" : "TEXT" };
}

/**
 * Infer a set of column definitions from parsed spreadsheet headers + rows.
 * Used when importing a CSV/Excel file into a brand-new template.
 */
export function inferColumns(
  headers: string[],
  rows: Record<string, string>[],
): InferredColumn[] {
  const used = new Set<string>();
  const sample = rows.slice(0, 100);
  return headers
    .filter((h) => h && h.trim())
    .map((header) => {
      const values = sample.map((r) => r[header] ?? "");
      const detected = detectType(header, values);
      return {
        key: keyFromName(header, used),
        name: header.trim(),
        type: detected.type,
        options: detected.options,
        currency: detected.currency,
      };
    });
}
