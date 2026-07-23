"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { AIExtractionResult } from "@/lib/types";
import type { CellValue } from "@/lib/columns";

export function useExtractRow(spreadsheetId: string) {
  return useMutation({
    mutationFn: (input: { transcript: string; current?: Record<string, CellValue> }) =>
      apiPost<AIExtractionResult>("/api/ai/extract", {
        spreadsheetId,
        transcript: input.transcript,
        current: input.current,
      }),
  });
}

export function useCleanupRows(spreadsheetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowIds: string[]) =>
      apiPost<{ updated: number }>("/api/ai/cleanup", { spreadsheetId, rowIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rows(spreadsheetId) });
      qc.invalidateQueries({ queryKey: queryKeys.history(spreadsheetId) });
    },
  });
}
