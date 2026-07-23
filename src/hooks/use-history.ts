"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiList, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { HistoryEntryDTO, RowDTO } from "@/lib/types";

export function useSpreadsheetHistory(spreadsheetId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.history(spreadsheetId),
    queryFn: () =>
      apiList<HistoryEntryDTO>(`/api/spreadsheets/${spreadsheetId}/history?pageSize=100`),
    enabled,
  });
}

export function useRestoreRow(spreadsheetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, historyId }: { rowId: string; historyId: string }) =>
      apiPost<RowDTO>(`/api/spreadsheets/${spreadsheetId}/rows/${rowId}/restore`, { historyId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rows(spreadsheetId) });
      qc.invalidateQueries({ queryKey: queryKeys.history(spreadsheetId) });
    },
  });
}
