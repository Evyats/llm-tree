import { MarkerType, type Edge, type Node } from "reactflow";

import type { GraphEdgePayload, GraphNodePayload } from "../types/graph";
import type { NodeData } from "./useGraphStore";

export function nodePayloadToFlowNode(node: GraphNodePayload): Node<NodeData> {
  return {
    id: node.id,
    type: node.role === "assistant" ? "assistantNode" : "userNode",
    position: { x: node.position_x, y: node.position_y },
    data: {
      role: node.role,
      parentId: node.parent_id,
      text: node.text,
      variants: node.variants,
      variantIndex: node.variant_index,
      mode: node.mode,
      highlightedText: node.highlighted_text,
    },
  };
}

export function edgePayloadToFlowEdge(edge: GraphEdgePayload): Edge {
  return {
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    type: "straight",
    animated: edge.edge_type === "reply",
    style: { strokeWidth: 2 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#176b87",
    },
  };
}
