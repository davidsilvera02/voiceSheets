import { z } from "zod";
import { COLUMN_TYPES } from "@/lib/columns";

/** Zod schemas shared by API route validation and client-side forms. */

export const columnTypeSchema = z.enum(COLUMN_TYPES);

export const columnConfigSchema = z
  .object({
    currency: z.string().length(3).optional(),
    precision: z.number().int().min(0).max(10).optional(),
    dateFormat: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    multiline: z.boolean().optional(),
  })
  .partial();

export const templateColumnInputSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/, "Key must be snake_case")
    .max(64)
    .optional(),
  name: z.string().min(1, "Column name is required").max(120),
  type: columnTypeSchema.default("TEXT"),
  required: z.boolean().default(false),
  defaultValue: z.string().max(500).nullish(),
  description: z.string().max(1000).nullish(),
  example: z.string().max(500).nullish(),
  aiHint: z.string().max(1000).nullish(),
  options: z.array(z.string().min(1)).max(200).optional(),
  config: columnConfigSchema.nullish(),
  position: z.number().int().min(0).optional(),
});

export type TemplateColumnInput = z.infer<typeof templateColumnInputSchema>;

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(160),
  description: z.string().max(2000).nullish(),
  icon: z.string().max(40).nullish(),
  color: z.string().max(40).nullish(),
  columns: z.array(templateColumnInputSchema).min(1, "Add at least one column").max(200),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).nullish(),
  icon: z.string().max(40).nullish(),
  color: z.string().max(40).nullish(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  columns: z.array(templateColumnInputSchema).max(200).optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const createSpreadsheetSchema = z.object({
  templateId: z.string().min(1, "A template is required"),
  name: z.string().min(1, "Spreadsheet name is required").max(200),
  description: z.string().max(2000).nullish(),
});

export const updateSpreadsheetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullish(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  isFavorite: z.boolean().optional(),
  // Per-spreadsheet view state persisted onto the column snapshot.
  columns: z
    .array(
      z.object({
        key: z.string(),
        hidden: z.boolean().optional(),
        width: z.number().int().min(40).max(1200).optional(),
        position: z.number().int().optional(),
      }),
    )
    .optional(),
});

/** Row values are an open record keyed by column key; typed coercion and
 * validation happen against the spreadsheet's column snapshot server-side. */
export const rowValuesSchema = z.record(z.string(), z.unknown());

export const cellMetaSchema = z.record(
  z.string(),
  z.object({
    aiGenerated: z.boolean().optional(),
    confidence: z.number().min(0).max(1).nullish(),
  }),
);

export const createRowSchema = z.object({
  values: rowValuesSchema.default({}),
  source: z.enum(["MANUAL", "VOICE", "AI", "IMPORT"]).default("MANUAL"),
  position: z.number().int().optional(),
  meta: cellMetaSchema.optional(),
});

export const updateRowSchema = z.object({
  values: rowValuesSchema,
});

export const bulkUpdateRowsSchema = z.object({
  rowIds: z.array(z.string().min(1)).min(1).max(1000),
  values: rowValuesSchema,
});

export const bulkDeleteRowsSchema = z.object({
  rowIds: z.array(z.string().min(1)).min(1).max(1000),
});

export const importRowsSchema = z.object({
  rows: z.array(rowValuesSchema).min(1).max(5000),
  source: z.enum(["IMPORT", "MANUAL"]).default("IMPORT"),
});

export const userSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  dateFormat: z.string().max(40).optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().max(20).optional(),
  aiPreferences: z
    .object({
      autoSuggest: z.boolean().optional(),
      model: z.string().optional(),
      temperature: z.number().min(0).max(1).optional(),
      cleanupOnImport: z.boolean().optional(),
    })
    .partial()
    .optional(),
  exportDefaults: z
    .object({
      format: z.enum(["csv", "xlsx"]).optional(),
      includeHidden: z.boolean().optional(),
    })
    .partial()
    .optional(),
});

export const aiExtractSchema = z.object({
  spreadsheetId: z.string().min(1),
  transcript: z.string().min(1, "Provide a transcript to process").max(8000),
  // Optionally refine an existing pending row ("no, the quantity is thirty").
  current: rowValuesSchema.optional(),
});

export const aiCleanupSchema = z.object({
  spreadsheetId: z.string().min(1),
  rowIds: z.array(z.string()).min(1).max(500),
});
