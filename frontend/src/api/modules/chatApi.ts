import type { ContinueResponse } from "../../features/chat/types";
import { request } from "../http";
import type { ContinueInPanelRequest } from "../types";

export async function continueInPanel(payload: ContinueInPanelRequest): Promise<ContinueResponse> {
  return request("/api/chat/continue", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
