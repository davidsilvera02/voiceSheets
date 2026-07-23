"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { SettingsDTO } from "@/server/services/settings-service";

export interface MeResponse {
  user: { id: string; email: string; name: string | null; imageUrl: string | null };
  workspace: { id: string; name: string };
  role: string;
  capabilities: { clerk: boolean; anthropic: boolean; whisper: boolean };
}

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => apiGet<MeResponse>("/api/me") });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiGet<SettingsDTO>("/api/settings"),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => apiPatch<SettingsDTO>("/api/settings", input),
    onSuccess: (data) => qc.setQueryData(queryKeys.settings, data),
  });
}
