"use client";

/** Tiny typed fetch wrapper for the demo API. Throws on non-2xx. */
export async function api<T = unknown>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body
        ? String((body as any).error)
        : res.statusText) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}
