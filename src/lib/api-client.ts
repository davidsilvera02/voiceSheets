import type { ApiError, ApiListSuccess } from "@/lib/types";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let payload: ApiError | undefined;
    try {
      payload = (await res.json()) as ApiError;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiClientError(
      payload?.error?.message ?? res.statusText ?? "Request failed",
      res.status,
      payload?.error?.code ?? "error",
      payload?.error?.details,
    );
  }
  return res;
}

/** GET a single-object endpoint, returning the unwrapped `data`. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await request<T>(path, { method: "GET" });
  const json = (await res.json()) as { data: T };
  return json.data;
}

/** GET a list endpoint, returning `{ data, meta }`. */
export async function apiList<T>(path: string): Promise<ApiListSuccess<T>> {
  const res = await request<T>(path, { method: "GET" });
  return (await res.json()) as ApiListSuccess<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as { data: T };
  return json.data;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  const json = (await res.json()) as { data: T };
  return json.data;
}

export async function apiDelete<T = { deleted: boolean }>(path: string, body?: unknown): Promise<T> {
  const res = await request<T>(path, {
    method: "DELETE",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as { data: T };
  return json.data;
}
