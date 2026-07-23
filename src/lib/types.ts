import type { CellValue, ColumnDefinition } from "@/lib/columns";

/** Data-transfer objects returned by the REST API (client-safe). */

export interface TemplateColumnDTO extends ColumnDefinition {
  id?: string;
}

export interface TemplateDTO {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  status: "ACTIVE" | "ARCHIVED";
  columns: TemplateColumnDTO[];
  spreadsheetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpreadsheetSummaryDTO {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  isFavorite: boolean;
  templateId: string | null;
  templateName: string | null;
  rowCount: number;
  columnCount: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface SpreadsheetDTO extends SpreadsheetSummaryDTO {
  columns: ColumnDefinition[];
}

export interface CellMeta {
  aiGenerated: boolean;
  confidence: number | null;
}

export interface RowDTO {
  id: string;
  position: number;
  source: "MANUAL" | "VOICE" | "AI" | "IMPORT";
  values: Record<string, CellValue>;
  meta: Record<string, CellMeta>;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntryDTO {
  id: string;
  rowId: string | null;
  changeType: "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "IMPORT";
  columnKey: string | null;
  previousValue: CellValue;
  newValue: CellValue;
  snapshot: Record<string, CellValue> | null;
  actorName: string | null;
  createdAt: string;
}

export interface ColumnStat {
  key: string;
  name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

export interface DuplicateGroup {
  signature: string;
  rowIds: string[];
}

export interface AuditLogDTO {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface GlobalSearchResult {
  templates: { id: string; name: string; description: string | null }[];
  spreadsheets: { id: string; name: string; templateName: string | null }[];
  rows: {
    id: string;
    spreadsheetId: string;
    spreadsheetName: string;
    snippet: string;
  }[];
}

/** Field-level AI extraction result with a confidence score in [0,1]. */
export interface AIField {
  value: CellValue;
  confidence: number;
  reasoning?: string;
}

export interface AIExtractionResult {
  fields: Record<string, AIField>;
  missing: string[]; // column keys the AI could not fill
  notes: string | null; // e.g. clarifying questions / assumptions
  usedFallback: boolean; // true when the heuristic parser was used
}

/** Standard API envelopes. */
export interface ApiSuccess<T> {
  data: T;
}
export interface ApiListSuccess<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}
export interface ApiError {
  error: { message: string; code: string; details?: unknown };
}
