"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public errors?: Record<string, string>,
  ) {
    super(message);
  }
}

function csrfToken(): string {
  const m = document.cookie.match(/(?:^|; )adzkia_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

/** Klien API: membaca envelope { success, message, data } dan melempar ApiError bila gagal. */
export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET") headers["x-csrf-token"] = csrfToken();

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Tidak dapat terhubung ke server. Periksa koneksi internet.", 0, "NETWORK");
  }
  let json: { success?: boolean; message?: string; data?: T; code?: string; errors?: Record<string, string> } = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  if (res.status === 401 && !path.startsWith("/api/auth/login")) {
    window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search);
    throw new ApiError("Sesi berakhir", 401, "UNAUTHORIZED");
  }
  if (!res.ok || json.success === false) {
    throw new ApiError(json.message ?? "Terjadi kesalahan", res.status, json.code, json.errors);
  }
  return json.data as T;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
