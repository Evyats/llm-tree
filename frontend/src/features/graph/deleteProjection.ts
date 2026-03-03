import type { Edge, Node } from "reactflow";

import type { NodeData } from "../../store/useGraphStore";

export interface DeleteProjectionSnapshot {
  previousNodes: Node<NodeData>[];
  previousEdges: Edge[];
  nextNodes: Node<NodeData>[];
  nextEdges: Edge[];
}

export function buildDeleteProjection(
  nodes: Node<NodeData>[],
  edges: Edge[],
  idsToDelete: Set<string>
): DeleteProjectionSnapshot {
  const nextNodes = nodes.filter((node) => !idsToDelete.has(node.id));
  const nextEdges = edges.filter((edge) => !idsToDelete.has(edge.source) && !idsToDelete.has(edge.target));
  return {
    previousNodes: nodes,
    previousEdges: edges,
    nextNodes,
    nextEdges,
  };
}
