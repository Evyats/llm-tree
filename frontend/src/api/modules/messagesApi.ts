import type { GraphEdgePayload, GraphNodePayload } from "../../types/graph";
import { request } from "../http";
import type { ContinueFromNodeRequest } from "../types";

export async function continueFromNode(payload: ContinueFromNodeRequest): Promise<{
  created_user_node: GraphNodePayload;
  created_assistant_node: GraphNodePayload;
  created_edges: GraphEdgePayload[];
  response_source: "live" | "fallback";
  transcript_window: Array<{ role: string; content: string }>;
}> {
  return request("/api/messages/continue", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
