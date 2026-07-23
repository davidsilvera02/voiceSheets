import { describe, expect, it } from "vitest";
import {
  type ColumnDefinition,
  coerceValue,
  coerceRecord,
  formatCellValue,
  parseDate,
  parseNumeric,
  validateCellValue,
} from "@/lib/columns";

function col(partial: Partial<ColumnDefinition> & Pick<ColumnDefinition, "key" | "name" | "type">): ColumnDefinition {
  return { position: 0, required: false, ...partial } as ColumnDefinition;
}

describe("parseNumeric", () => {
  it("strips currency symbols and separators", () => {
    expect(parseNumeric("$1,234.50")).toBe(1234.5);
    expect(parseNumeric("30")).toBe(30);
    expect(parseNumeric("abc")).toBeNull();
    expect(parseNumeric(42)).toBe(42);
  });
});

describe("parseDate", () => {
  it("normalizes to ISO date", () => {
    expect(parseDate("2026-07-21")).toBe("2026-07-21");
    expect(parseDate("07/21/2026")).toBe("2026-07-21");
    expect(parseDate("not a date")).toBeNull();
  });
});

describe("coerceValue", () => {
  it("coerces by column type", () => {
    expect(coerceValue(col({ key: "q", name: "Q", type: "NUMBER" }), "  30 ")).toBe(30);
    expect(coerceValue(col({ key: "p", name: "P", type: "CURRENCY" }), "$4.50")).toBe(4.5);
    expect(coerceValue(col({ key: "b", name: "B", type: "BOOLEAN" }), "yes")).toBe(true);
    expect(coerceValue(col({ key: "t", name: "T", type: "TEXT" }), "  ")).toBeNull();
  });

  it("matches dropdown options case-insensitively", () => {
    const c = col({ key: "s", name: "S", type: "DROPDOWN", options: ["High", "Low"] });
    expect(coerceValue(c, "high")).toBe("High");
  });
});

describe("validateCellValue", () => {
  it("flags required empty fields", () => {
    const c = col({ key: "v", name: "Vendor", type: "TEXT", required: true });
    expect(validateCellValue(c, null)).toMatch(/required/);
    expect(validateCellValue(c, "Acme")).toBeNull();
  });

  it("enforces dropdown membership", () => {
    const c = col({ key: "s", name: "Status", type: "DROPDOWN", options: ["A", "B"] });
    expect(validateCellValue(c, "C")).toMatch(/must be one of/);
    expect(validateCellValue(c, "A")).toBeNull();
  });

  it("enforces numeric min/max", () => {
    const c = col({ key: "n", name: "N", type: "NUMBER", config: { min: 1, max: 10 } });
    expect(validateCellValue(c, 0)).toMatch(/≥/);
    expect(validateCellValue(c, 11)).toMatch(/≤/);
    expect(validateCellValue(c, 5)).toBeNull();
  });
});

describe("formatCellValue", () => {
  it("formats currency", () => {
    const c = col({ key: "p", name: "P", type: "CURRENCY", config: { currency: "USD" } });
    expect(formatCellValue(c, 1234.5)).toContain("1,234.50");
  });
  it("formats booleans", () => {
    const c = col({ key: "b", name: "B", type: "BOOLEAN" });
    expect(formatCellValue(c, true)).toBe("Yes");
    expect(formatCellValue(c, false)).toBe("No");
  });
});

describe("coerceRecord", () => {
  it("returns typed values and per-field errors", () => {
    const columns = [
      col({ key: "vendor", name: "Vendor", type: "TEXT", required: true }),
      col({ key: "qty", name: "Qty", type: "NUMBER", required: true }),
    ];
    const { values, errors } = coerceRecord(columns, { vendor: "Acme", qty: "not a number" });
    expect(values.vendor).toBe("Acme");
    expect(errors.qty).toBeTruthy();
  });
});
