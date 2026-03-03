import type { Edge, Node } from "reactflow";

import type { NodeData } from "../../store/useGraphStore";

export function buildNodeMap(nodes: Node<NodeData>[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function getContinueFromVariantIndex(nodesById: Map<string, Node<NodeData>>, selectedNodeId: string | null) {
  if (!selectedNodeId) {
    return null;
  }
  const node = nodesById.get(selectedNodeId);
  if (!node || node.data.role !== "assistant") {
    return null;
  }
  return node.data.variantIndex;
}

export function getAssistantNodesWithUserBranch(nodesById: Map<string, Node<NodeData>>, edges: Edge[]) {
  return new Set(
    edges
      .filter((edge) => nodesById.get(edge.source)?.data.role === "assistant" && nodesById.get(edge.target)?.data.role === "user")
      .map((edge) => edge.source)
  );
}
