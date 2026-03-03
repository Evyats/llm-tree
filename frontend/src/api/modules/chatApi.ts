import type { GraphEdgePayload, GraphNodePayload } from "../../types/graph";
import { request } from "../http";
import type { ContinueInPanelRequest } from "../types";

export async function continueInPanel(payload: ContinueInPanelRequest): Promise<{
  created_user_node: GraphNodePayload;
  created_assistant_node: GraphNodePayload;
  created_edges: GraphEdgePayload[];
  response_source: "live" | "fallback";
  transcript_window: Array<{ role: string; content: string }>;
}> {
  return request("/api/chat/continue", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
