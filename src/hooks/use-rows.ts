"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiList, apiPatch, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { ApiListSuccess, CellMeta, RowDTO } from "@/lib/types";
import type { CellValue } from "@/lib/columns";

type RowList = ApiListSuccess<RowDTO>;

export function useRows(spreadsheetId: string) {
  return useQuery({
    queryKey: queryKeys.rows(spreadsheetId),
    queryFn: () => apiList<RowDTO>(`/api/spreadsheets/${spreadsheetId}/rows`),
  });
}

function invalidateDerived(qc: ReturnType<typeof useQueryClient>, spreadsheetId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.stats(spreadsheetId) });
  qc.invalidateQueries({ queryKey: queryKeys.duplicates(spreadsheetId) });
  qc.invalidateQueries({ queryKey: queryKeys.history(spreadsheetId) });
}

export function useCreateRow(spreadsheetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      values: Record<string, CellValue>;
      source?: "MANUAL" | "VOICE" | "AI" | "IMPORT";
      meta?: Record<string, { aiGenerated?: boolean; confidence?: number | null }>;
    }) => apiPost<RowDTO>(`/api/spreadsheets/${spreadsheetId}/rows`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rows(spreadsheetId) });
      invalidateDerived(qc, spreadsheetId);
    },
  });
}

/** Optimistic single-row patch used by the grid's autosave. */
export function useUpdateRow(spreadsheetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowId, values }: { rowId: string; values: Record<string, CellValue> }) =>
      apiPatch<RowDTO>(`/api/spreadsheets/${spreadsheetId}/rows/${rowId}`, { values }),
    onMutate: async ({ rowId, values }) => {
      const key = queryKeys.rows(spreadsheetId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<RowList>(key);
      if (previous) {
        qc.setQueryData<RowList>(key, {
          ...previous,
          data: previous.data.map((row) =>
            row.id === rowId ? { ...row, values: { ...row.values, ...values } } : row,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKeys.rows(spreadsheetId), context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rows(spreadsheetId) });
      invalidateDerived(qc, spreadsheetId);
    },
  });
}

export function useDeleteRow(spreadsheetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowId: string) =>
      apiDelete(`/api/spreadsheets/${spreadsheetId}/rows/${rowId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rows(spreadsheetId) });
      invalidateDerived(qc, spreadsheetId);
    },
  });
}

export function useBulkUpdateRows(spreadsheetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rowIds, values }: { rowIds: string[]; values: Record<string, CellValue> }) =>
      apiPatch(`/api/spreadsheets/${spreadsheetId}/rows/bulk`, { rowIds, values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rows(spreadsheetId) });
      invalidateDerived(qc, spreadsheetId);
    },
  });
}

export function useBulkDeleteRows(spreadsheetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowIds: string[]) =>
      apiDelete(`/api/spreadsheets/${spreadsheetId}/rows/bulk`, { rowIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rows(spreadsheetId) });
      invalidateDerived(qc, spreadsheetId);
    },
  });
}

export function useImportRows(spreadsheetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, CellValue>[]) =>
      apiPost<{ imported: number; failed: number; errors: { index: number; message: string }[] }>(
        `/api/spreadsheets/${spreadsheetId}/import`,
        { rows, source: "IMPORT" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rows(spreadsheetId) });
      invalidateDerived(qc, spreadsheetId);
    },
  });
}

export type { CellMeta };
