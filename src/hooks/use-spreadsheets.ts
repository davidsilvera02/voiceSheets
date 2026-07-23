"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiList, apiPatch, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { SpreadsheetDTO, SpreadsheetSummaryDTO } from "@/lib/types";

export function useSpreadsheets(
  params: { status?: "ACTIVE" | "ARCHIVED"; favorite?: boolean; templateId?: string; q?: string } = {},
) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.favorite) search.set("favorite", "true");
  if (params.templateId) search.set("templateId", params.templateId);
  if (params.q) search.set("q", params.q);
  return useQuery({
    queryKey: queryKeys.spreadsheets(params),
    queryFn: () => apiList<SpreadsheetSummaryDTO>(`/api/spreadsheets?${search.toString()}`),
  });
}

export function useSpreadsheet(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.spreadsheet(id ?? ""),
    queryFn: () => apiGet<SpreadsheetDTO>(`/api/spreadsheets/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateSpreadsheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { templateId: string; name: string; description?: string }) =>
      apiPost<SpreadsheetDTO>("/api/spreadsheets", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spreadsheets"] }),
  });
}

export function useUpdateSpreadsheet(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiPatch<SpreadsheetDTO>(`/api/spreadsheets/${id}`, input),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.spreadsheet(id), data);
      qc.invalidateQueries({ queryKey: ["spreadsheets"] });
    },
  });
}

export function useDuplicateSpreadsheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, withRows }: { id: string; withRows: boolean }) =>
      apiPost<SpreadsheetDTO>(`/api/spreadsheets/${id}/duplicate`, { withRows }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spreadsheets"] }),
  });
}

export function useDeleteSpreadsheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/spreadsheets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spreadsheets"] }),
  });
}
