/** Centralized TanStack Query key factory for cache consistency. */
export const queryKeys = {
  me: ["me"] as const,
  settings: ["settings"] as const,
  templates: (params?: Record<string, unknown>) => ["templates", params ?? {}] as const,
  template: (id: string) => ["template", id] as const,
  spreadsheets: (params?: Record<string, unknown>) => ["spreadsheets", params ?? {}] as const,
  spreadsheet: (id: string) => ["spreadsheet", id] as const,
  rows: (spreadsheetId: string) => ["rows", spreadsheetId] as const,
  rowHistory: (spreadsheetId: string, rowId: string) =>
    ["rowHistory", spreadsheetId, rowId] as const,
  history: (spreadsheetId: string) => ["history", spreadsheetId] as const,
  stats: (spreadsheetId: string) => ["stats", spreadsheetId] as const,
  duplicates: (spreadsheetId: string) => ["duplicates", spreadsheetId] as const,
  audit: ["audit"] as const,
};
