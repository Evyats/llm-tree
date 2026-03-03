import type { ContinueResponse } from "../../features/chat/types";
import { request } from "../http";
import type { ContinueFromNodeRequest } from "../types";

export async function continueFromNode(payload: ContinueFromNodeRequest): Promise<ContinueResponse> {
  return request("/api/messages/continue", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
