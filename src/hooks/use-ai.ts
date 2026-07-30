"use client";

import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
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
