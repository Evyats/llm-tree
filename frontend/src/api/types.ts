export interface ChatSummary {
  graph_id: string;
  title: string;
  updated_at: string;
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
