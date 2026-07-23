import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  type CellValue,
  type ColumnDefinition,
  coerceValue,
  parseNumeric,
  parseDate,
  parseBoolean,
} from "@/lib/columns";
import { env, isAnthropicConfigured } from "@/lib/env";
import type { AIExtractionResult, AIField } from "@/lib/types";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

// Fast mode is only available on Opus 4.8 / 4.7 (premium priced, ~2.5x faster).
// We only attempt it for those models, and disable it if the account rejects it.
const FAST_CAPABLE_MODELS = new Set(["claude-opus-4-8", "claude-opus-4-7"]);
let fastModeEnabled = true;

function textOf(message: { content: Array<{ type: string; text?: string }> }): string {
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

/**
 * Call Claude for a structured extraction, preferring fast mode for lower
 * latency and falling back to a standard request when it is unavailable.
 */
async function createExtractionMessage(messages: Anthropic.MessageParam[]): Promise<string> {
  const base = {
    model: env.ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages,
    // Extraction is a simple, well-specified task — low effort is plenty and
    // markedly faster than the default (high).
    output_config: { effort: "low" as const },
  };
  if (fastModeEnabled && FAST_CAPABLE_MODELS.has(env.ANTHROPIC_MODEL)) {
    try {
      const message = await anthropic().beta.messages.create({
        ...base,
        speed: "fast",
        betas: ["fast-mode-2026-02-01"],
      });
      return textOf(message);
    } catch (error) {
      const status = (error as { status?: number }).status;
      // Retry fast mode on transient errors; disable on hard rejections.
      if (status && ![429, 500, 502, 503, 529].includes(status)) {
        fastModeEnabled = false;
        console.warn("[voicesheets] Fast mode unavailable, using standard requests.");
      }
      // fall through to a standard request for this call
    }
  }
  const message = await anthropic().messages.create(base);
  return textOf(message);
}

/**
 * Describe the template columns to the model in a compact, unambiguous form.
 * This is the heart of prompt construction — it turns column metadata (name,
 * type, description, AI hint, example, options) into extraction instructions.
 */
function describeColumns(columns: ColumnDefinition[]): string {
  return columns
    .map((c) => {
      const parts = [`- key: "${c.key}"`, `name: "${c.name}"`, `type: ${c.type}`];
      if (c.required) parts.push("required: true");
      if (c.description) parts.push(`description: ${JSON.stringify(c.description)}`);
      if (c.aiHint) parts.push(`ai_hint: ${JSON.stringify(c.aiHint)}`);
      if (c.example) parts.push(`example: ${JSON.stringify(c.example)}`);
      if (c.type === "DROPDOWN" && c.options?.length) {
        parts.push(`allowed_values: ${JSON.stringify(c.options)}`);
      }
      if (c.type === "CURRENCY") parts.push(`currency: ${c.config?.currency ?? "USD"}`);
      return parts.join(", ");
    })
    .join("\n");
}

const SYSTEM_PROMPT = `You are a precise data-extraction assistant for a purchasing spreadsheet app.
You convert a spoken/typed transcript into a single structured row that matches a given schema.

Rules:
- Return ONLY valid JSON. No prose, no markdown fences.
- The JSON shape is: {"fields": {"<key>": {"value": <string|number|boolean|null>, "confidence": <number 0..1>}}, "notes": "<string>"}
- Include one entry in "fields" for every schema key.
- NEVER invent information that is not present or clearly implied by the transcript. If a field is unknown, set value to null and confidence to 0.
- Respect types: NUMBER/CURRENCY -> a JSON number (no symbols or commas); DATE -> "YYYY-MM-DD"; BOOLEAN -> true/false; DROPDOWN -> exactly one of the allowed_values; TEXT/LONG_TEXT -> a string.
- DATE handling: resolve relative expressions ("today", "tomorrow", "yesterday", "next Friday", "in two weeks", "end of the month") against the Current date given in the message, and output the resolved "YYYY-MM-DD".
- confidence reflects how certain you are the value is correct given the transcript (1 = explicitly stated, ~0.6 = inferred, 0 = missing).
- "notes" may briefly list assumptions or clarifying questions; keep it short or empty.
- Be fast and concise: output only the JSON, no explanations.`;

function buildUserPrompt(
  columns: ColumnDefinition[],
  transcript: string,
  current?: Record<string, CellValue>,
): string {
  const schema = describeColumns(columns);
  const now = new Date();
  const dateLine = `Current date: ${now.toISOString().slice(0, 10)} (${now.toLocaleDateString(
    "en-US",
    { weekday: "long" },
  )}).`;
  const currentBlock = current
    ? `\n\nThe user is correcting an existing draft row. Apply their correction and keep the other fields unless the correction changes them. Current draft (JSON):\n${JSON.stringify(current)}`
    : "";
  return `${dateLine}\n\nSchema columns:\n${schema}${currentBlock}\n\nTranscript:\n"""${transcript}"""\n\nReturn the JSON row now.`;
}

/** Extract the first balanced JSON object from a possibly-noisy string. */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("No JSON object found in model response");
  }
}

interface RawField {
  value: unknown;
  confidence?: number;
  reasoning?: string;
}

/** Coerce/validate the model's raw fields into typed, schema-safe values. */
function normalizeFields(
  columns: ColumnDefinition[],
  raw: Record<string, RawField> | undefined,
  current?: Record<string, CellValue>,
): { fields: Record<string, AIField>; missing: string[] } {
  const fields: Record<string, AIField> = {};
  const missing: string[] = [];
  const rawFields = raw ?? {};

  for (const column of columns) {
    const entry = rawFields[column.key];
    let value = coerceValue(column, entry?.value ?? null);
    let confidence = clamp01(entry?.confidence ?? (value === null ? 0 : 0.6));

    // Merge with an existing draft during iterative corrections.
    if (value === null && current && current[column.key] != null) {
      value = current[column.key]!;
      confidence = Math.max(confidence, 0.75);
    }

    fields[column.key] = {
      value,
      confidence,
      reasoning: entry?.reasoning,
    };
    if (value === null) missing.push(column.key);
  }
  return { fields, missing };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Turn a transcript into a structured, confidence-scored row.
 * Uses Claude when configured; otherwise a deterministic heuristic parser so
 * the review flow is demoable end-to-end without an API key.
 */
export async function extractRow(params: {
  columns: ColumnDefinition[];
  transcript: string;
  current?: Record<string, CellValue>;
}): Promise<AIExtractionResult> {
  const { columns, transcript, current } = params;

  if (!isAnthropicConfigured()) {
    return heuristicExtract(columns, transcript, current);
  }

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildUserPrompt(columns, transcript, current) },
  ];

  // Up to two attempts: retry once with a corrective nudge on malformed JSON.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await createExtractionMessage(messages);
      const parsed = extractJson(text) as {
        fields?: Record<string, RawField>;
        notes?: string;
      };
      const { fields, missing } = normalizeFields(columns, parsed.fields, current);
      return {
        fields,
        missing,
        notes: parsed.notes?.trim() || null,
        usedFallback: false,
      };
    } catch (error) {
      if (attempt === 0) {
        messages.push({
          role: "assistant",
          content: "I will return only valid JSON matching the schema.",
        });
        messages.push({
          role: "user",
          content: "Your previous response was not valid JSON. Reply with ONLY the JSON object.",
        });
        continue;
      }
      console.error("[voicesheets] AI extraction failed, using heuristic fallback:", error);
      return heuristicExtract(columns, transcript, current);
    }
  }
  return heuristicExtract(columns, transcript, current);
}

/**
 * A best-effort, dependency-free extractor for local dev without an API key.
 * Looks for "<field> is/= <value>" phrases plus type-appropriate tokens.
 */
function heuristicExtract(
  columns: ColumnDefinition[],
  transcript: string,
  current?: Record<string, CellValue>,
): AIExtractionResult {
  const text = transcript.trim();
  const lower = text.toLowerCase();
  const fields: Record<string, AIField> = {};
  const missing: string[] = [];

  for (const column of columns) {
    let value: CellValue = null;
    let confidence = 0;

    // "<name> is X" / "<name>: X" / "<name> = X"
    const nameEsc = column.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const phrase = new RegExp(`${nameEsc}\\s*(?:is|:|=|of|=)\\s*([^,.;\\n]+)`, "i");
    const m = text.match(phrase);
    const captured = m?.[1]?.trim();

    if (captured) {
      value = coerceValue(column, captured);
      confidence = value !== null ? 0.55 : 0;
    }

    // Type-specific fallbacks when the phrase match missed.
    if (value === null) {
      if (column.type === "NUMBER" || column.type === "CURRENCY") {
        const num = text.match(/\$?\s?(\d[\d,]*\.?\d*)/);
        if (num) {
          value = parseNumeric(num[1]);
          confidence = 0.35;
        }
      } else if (column.type === "DATE") {
        const d = text.match(/\d{4}-\d{2}-\d{2}|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
        if (d) {
          value = parseDate(d[0]);
          confidence = 0.4;
        }
      } else if (column.type === "BOOLEAN") {
        const b = parseBoolean(lower.includes(column.name.toLowerCase()) ? "yes" : "");
        if (b !== null && (lower.includes("yes") || lower.includes("no"))) {
          value = lower.includes("no") ? false : true;
          confidence = 0.3;
        }
      } else if (column.type === "DROPDOWN") {
        const match = (column.options ?? []).find((o) => lower.includes(o.toLowerCase()));
        if (match) {
          value = match;
          confidence = 0.5;
        }
      }
    }

    if (value === null && current?.[column.key] != null) {
      value = current[column.key]!;
      confidence = 0.7;
    }

    fields[column.key] = { value, confidence };
    if (value === null) missing.push(column.key);
  }

  return {
    fields,
    missing,
    notes:
      "Generated by the built-in heuristic parser (no ANTHROPIC_API_KEY set). Please review every field.",
    usedFallback: true,
  };
}

/**
 * Clean up a batch of existing rows: standardize vendor capitalization, trim
 * whitespace, normalize currency/number/date formatting. Returns per-row
 * corrected value maps. Uses Claude when available, else deterministic rules.
 */
export async function cleanupRows(params: {
  columns: ColumnDefinition[];
  rows: { id: string; values: Record<string, CellValue> }[];
}): Promise<{ id: string; values: Record<string, CellValue> }[]> {
  const { columns, rows } = params;

  const deterministic = () =>
    rows.map((row) => {
      const values: Record<string, CellValue> = {};
      for (const column of columns) {
        let v = row.values[column.key] ?? null;
        if (typeof v === "string") {
          v = v.trim().replace(/\s+/g, " ");
          if (column.type === "TEXT" && v.length > 0) {
            // Title-case short vendor/product style text.
            v = v.replace(/\b\w/g, (ch) => ch.toUpperCase());
          }
        }
        values[column.key] = coerceValue(column, v);
      }
      return { id: row.id, values };
    });

  if (!isAnthropicConfigured()) return deterministic();

  try {
    const message = await anthropic().messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 4096,
      system:
        "You standardize spreadsheet data. Fix capitalization of vendor/product names, trim whitespace, normalize currencies and dates, and correct obvious formatting issues. Do not invent or change the meaning of values. Return ONLY JSON of shape {\"rows\":[{\"id\":\"...\",\"values\":{\"<key>\":<value>}}]}.",
      messages: [
        {
          role: "user",
          content: `Columns:\n${describeColumns(columns)}\n\nRows JSON:\n${JSON.stringify(rows)}\n\nReturn the cleaned rows JSON.`,
        },
      ],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = extractJson(text) as {
      rows?: { id: string; values: Record<string, unknown> }[];
    };
    if (!parsed.rows) return deterministic();
    return parsed.rows.map((row) => {
      const values: Record<string, CellValue> = {};
      for (const column of columns) {
        values[column.key] = coerceValue(column, row.values?.[column.key] ?? null);
      }
      return { id: row.id, values };
    });
  } catch (error) {
    console.error("[voicesheets] AI cleanup failed, using deterministic rules:", error);
    return deterministic();
  }
}
