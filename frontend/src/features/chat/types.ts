import type { GraphEdgePayload, GraphNodePayload } from "../../types/graph";

export interface TranscriptLine {
  role: "user" | "assistant";
  content: string;
}

export interface ContinueResponse {
  created_user_node: GraphNodePayload;
  created_assistant_node: GraphNodePayload;
  created_edges: GraphEdgePayload[];
  response_source: "live" | "fallback";
  transcript_window: TranscriptLine[];
}
