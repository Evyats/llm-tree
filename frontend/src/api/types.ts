import type { GraphEdgePayload, GraphNodePayload } from "../types/graph";

export interface ChatSummary {
  graph_id: string;
  title: string;
  title_state: string;
  updated_at: string;
}

export interface GenerateGraphTitleResponse {
  graph_id: string;
  title: string;
  title_state: string;
  response_source: "live" | "fallback";
}

export interface ContinueFromNodeRequest {
  graph_id: string;
  continue_from_node_id: string | null;
  continue_from_variant_index?: number | null;
  user_text: string;
  mode: "normal" | "elaboration";
  highlighted_text?: string | null;
  selected_model?: string | null;
}

export interface ContinueInPanelRequest {
  graph_id: string;
  anchor_node_id: string;
  anchor_variant_index?: number | null;
  user_text: string;
  selected_model?: string | null;
}

export interface AvailableModelsResponse {
  models: string[];
}

export interface CompactBranchResponse {
  graph_id: string;
  title: string;
  title_state: string;
  nodes: GraphNodePayload[];
  edges: GraphEdgePayload[];
  response_source: "live" | "fallback";
  compacted_node_id: string;
}
