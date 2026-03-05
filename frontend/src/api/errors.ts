export class ApiError extends Error {
  status: number;
  bodyText: string;
  body?: unknown;

  constructor(message: string, status: number, bodyText: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.bodyText = bodyText;
    this.body = body;
  }
}

export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

