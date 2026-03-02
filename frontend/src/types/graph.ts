export type NodeRole = "user" | "assistant";

export interface Variants {
  short: string;
  medium: string;
  long: string;
}

export interface GraphNodePayload {
  id: string;
  graph_id: string;
  role: NodeRole;
  parent_id: string | null;
  text: string;
  variants: Variants | null;
  variant_index: number;
  position_x: number;
  position_y: number;
  mode: string;
  highlighted_text: string | null;
}

export interface GraphEdgePayload {
  id: string;
  graph_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
}

export interface GraphResponse {
  graph_id: string;
  title: string;
  nodes: GraphNodePayload[];
  edges: GraphEdgePayload[];
}

