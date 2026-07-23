import { z } from "zod";

/**
 * The column-type system. This module is intentionally framework-agnostic and
 * safe to import from both client and server code. It is the single source of
 * truth for coercion, validation, formatting, and dynamic Zod-schema creation.
 */

export const COLUMN_TYPES = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "CURRENCY",
  "DATE",
  "BOOLEAN",
  "DROPDOWN",
] as const;

export type ColumnType = (typeof COLUMN_TYPES)[number];

export type CellValue = string | number | boolean | null;

export interface ColumnConfig {
  currency?: string; // ISO 4217 code, e.g. "USD"
  precision?: number; // decimal places for NUMBER/CURRENCY
  dateFormat?: string; // display format for DATE
  min?: number;
  max?: number;
  multiline?: boolean;
}

/**
 * The immutable snapshot of a column stored on a Spreadsheet. Derived from a
 * TemplateColumn at spreadsheet-creation time.
 */
export interface ColumnDefinition {
  key: string;
  name: string;
  type: ColumnType;
  position: number;
  required: boolean;
  defaultValue?: string | null;
  description?: string | null;
  example?: string | null;
  aiHint?: string | null;
  options?: string[] | null; // for DROPDOWN
  config?: ColumnConfig | null;
  hidden?: boolean; // per-spreadsheet view state
  width?: number; // per-spreadsheet view state
}

export const COLUMN_TYPE_META: Record<
  ColumnType,
  { label: string; description: string; icon: string }
> = {
  TEXT: { label: "Text", description: "Short single-line text", icon: "Type" },
  LONG_TEXT: { label: "Long text", description: "Multi-line notes", icon: "AlignLeft" },
  NUMBER: { label: "Number", description: "Numeric value", icon: "Hash" },
  CURRENCY: { label: "Currency", description: "Monetary amount", icon: "DollarSign" },
  DATE: { label: "Date", description: "Calendar date", icon: "Calendar" },
  BOOLEAN: { label: "Checkbox", description: "True / false", icon: "CheckSquare" },
  DROPDOWN: { label: "Dropdown", description: "Choose from a list", icon: "List" },
};

export function isEmpty(value: CellValue): boolean {
  return value === null || value === undefined || value === "";
}

/** Parse a possibly-formatted number ("$1,234.50", "30%") into a number. */
export function parseNumeric(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "boolean") return raw ? 1 : 0;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Normalize an arbitrary date-ish input to an ISO date string (yyyy-MM-dd). */
export function parseDate(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (s === "") return null;
  // Already ISO date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

const TRUE_WORDS = new Set(["true", "yes", "y", "1", "on", "checked"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0", "off", "unchecked", ""]);

export function parseBoolean(raw: unknown): boolean | null {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    const s = raw.trim().toLowerCase();
    if (TRUE_WORDS.has(s)) return true;
    if (FALSE_WORDS.has(s)) return false;
  }
  return null;
}

/**
 * Coerce a raw value (from a form, import, or the AI) into the correct native
 * type for the column. Returns null when the value cannot be represented.
 */
export function coerceValue(column: ColumnDefinition, raw: unknown): CellValue {
  if (raw === null || raw === undefined) return null;
  switch (column.type) {
    case "TEXT":
    case "LONG_TEXT": {
      const s = String(raw).trim();
      return s === "" ? null : s;
    }
    case "NUMBER":
    case "CURRENCY":
      return parseNumeric(raw);
    case "DATE":
      return parseDate(raw);
    case "BOOLEAN": {
      const b = parseBoolean(raw);
      return b === null ? null : b;
    }
    case "DROPDOWN": {
      const s = String(raw).trim();
      if (s === "") return null;
      const options = column.options ?? [];
      const match = options.find((o) => o.toLowerCase() === s.toLowerCase());
      return match ?? s; // keep raw; validation flags if not allowed
    }
    default:
      return null;
  }
}

/** Human-readable formatting for display in the grid and exports. */
export function formatCellValue(
  column: ColumnDefinition,
  value: CellValue,
  opts: { locale?: string } = {},
): string {
  if (isEmpty(value)) return "";
  const locale = opts.locale ?? "en-US";
  switch (column.type) {
    case "CURRENCY": {
      const n = typeof value === "number" ? value : parseNumeric(value);
      if (n === null) return "";
      const currency = column.config?.currency ?? "USD";
      try {
        return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
      } catch {
        return `${currency} ${n.toFixed(column.config?.precision ?? 2)}`;
      }
    }
    case "NUMBER": {
      const n = typeof value === "number" ? value : parseNumeric(value);
      if (n === null) return "";
      const precision = column.config?.precision;
      return precision !== undefined
        ? n.toFixed(precision)
        : new Intl.NumberFormat(locale).format(n);
    }
    case "BOOLEAN":
      return value ? "Yes" : "No";
    case "DATE": {
      const iso = parseDate(value);
      return iso ?? String(value);
    }
    default:
      return String(value);
  }
}

/**
 * Validate a coerced value against the column rules.
 * Returns an error message, or null when valid.
 */
export function validateCellValue(column: ColumnDefinition, value: CellValue): string | null {
  if (isEmpty(value)) {
    return column.required ? `${column.name} is required` : null;
  }
  switch (column.type) {
    case "NUMBER":
    case "CURRENCY": {
      if (typeof value !== "number") return `${column.name} must be a number`;
      const { min, max } = column.config ?? {};
      if (min !== undefined && value < min) return `${column.name} must be ≥ ${min}`;
      if (max !== undefined && value > max) return `${column.name} must be ≤ ${max}`;
      return null;
    }
    case "DATE":
      return parseDate(value) ? null : `${column.name} must be a valid date`;
    case "BOOLEAN":
      return typeof value === "boolean" ? null : `${column.name} must be true or false`;
    case "DROPDOWN": {
      const options = column.options ?? [];
      if (options.length === 0) return null;
      return options.some((o) => o === value)
        ? null
        : `${column.name} must be one of: ${options.join(", ")}`;
    }
    default:
      return null;
  }
}

/** Build a Zod schema for a single column (used by React Hook Form). */
export function zodForColumn(column: ColumnDefinition): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  switch (column.type) {
    case "NUMBER":
    case "CURRENCY":
      schema = z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : parseNumeric(v)),
        column.required
          ? z.number({ invalid_type_error: `${column.name} must be a number` })
          : z.number().optional(),
      );
      break;
    case "BOOLEAN":
      schema = z.boolean().optional();
      break;
    case "DATE":
      schema = z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : parseDate(v)),
        column.required
          ? z.string({ required_error: `${column.name} is required` })
          : z.string().optional(),
      );
      break;
    case "DROPDOWN": {
      const options = column.options ?? [];
      const base = options.length > 0 ? z.enum(options as [string, ...string[]]) : z.string();
      schema = column.required ? base : base.optional();
      break;
    }
    default: {
      const base = z.string();
      schema = column.required
        ? base.min(1, `${column.name} is required`)
        : base.optional();
    }
  }
  return schema;
}

/** Build a Zod object schema for an entire row keyed by column key. */
export function buildRowSchema(columns: ColumnDefinition[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const column of columns) shape[column.key] = zodForColumn(column);
  return z.object(shape);
}

/** The default (empty or configured) value for a column. */
export function defaultValueForColumn(column: ColumnDefinition): CellValue {
  if (column.defaultValue != null && column.defaultValue !== "") {
    return coerceValue(column, column.defaultValue);
  }
  return column.type === "BOOLEAN" ? false : null;
}

/** Coerce and validate an entire record; returns typed values + errors. */
export function coerceRecord(
  columns: ColumnDefinition[],
  input: Record<string, unknown>,
): { values: Record<string, CellValue>; errors: Record<string, string> } {
  const values: Record<string, CellValue> = {};
  const errors: Record<string, string> = {};
  for (const column of columns) {
    const coerced = coerceValue(column, input[column.key]);
    values[column.key] = coerced;
    const error = validateCellValue(column, coerced);
    if (error) errors[column.key] = error;
  }
  return { values, errors };
}
