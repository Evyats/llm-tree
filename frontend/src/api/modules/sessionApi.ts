import { request } from "../http";

export async function setSessionApiKey(apiKey: string): Promise<void> {
  await request("/api/session/api-key", {
    method: "POST",
    body: JSON.stringify({ api_key: apiKey }),
  });
}
