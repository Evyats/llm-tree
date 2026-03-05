import type { ContinueResponse } from "../../features/chat/types";
import { request } from "../http";
import type { AvailableModelsResponse, ContinueFromNodeRequest } from "../types";

export async function continueFromNode(payload: ContinueFromNodeRequest): Promise<ContinueResponse> {
  return request("/api/messages/continue", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listAvailableModels(): Promise<AvailableModelsResponse> {
  return request("/api/models");
}
