"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiList, apiPatch, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { TemplateDTO } from "@/lib/types";
import type { CreateTemplateInput, UpdateTemplateInput } from "@/lib/validations";

export function useTemplates(params: { status?: "ACTIVE" | "ARCHIVED"; q?: string } = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  return useQuery({
    queryKey: queryKeys.templates(params),
    queryFn: () => apiList<TemplateDTO>(`/api/templates?${search.toString()}`),
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.template(id ?? "new"),
    queryFn: () => apiGet<TemplateDTO>(`/api/templates/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) => apiPost<TemplateDTO>("/api/templates", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useUpdateTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTemplateInput) =>
      apiPatch<TemplateDTO>(`/api/templates/${id}`, input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.setQueryData(queryKeys.template(id), data);
    },
  });
}

export function useDuplicateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<TemplateDTO>(`/api/templates/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useSetTemplateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "ARCHIVED" }) =>
      apiPatch<TemplateDTO>(`/api/templates/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}
