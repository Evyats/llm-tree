import { ApiError } from "./errors";

const base = import.meta.env.VITE_API_BASE_URL ?? "";

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    const bodyText = await response.text();
    let parsedBody: unknown;
    let message = bodyText;
    try {
      parsedBody = bodyText ? JSON.parse(bodyText) : undefined;
      if (parsedBody && typeof parsedBody === "object" && "detail" in parsedBody) {
        const detail = (parsedBody as { detail?: unknown }).detail;
        if (typeof detail === "string" && detail.trim().length > 0) {
          message = detail;
        }
      }
    } catch {
      parsedBody = undefined;
    }
    throw new ApiError(message || `HTTP ${response.status}`, response.status, bodyText, parsedBody);
  }
  return response.json() as Promise<T>;
}
