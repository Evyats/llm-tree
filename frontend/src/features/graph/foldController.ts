import type { Edge, Node } from "reactflow";
import type { NodeData } from "../../store/useGraphStore";
import { resolveFoldEdge } from "./collapseProjection";

interface FoldControllerParams {
  nodesById: Map<string, Node<NodeData>>;
  hiddenNodeIds: Set<string>;
  collapsedTargets: Set<string>;
  getSubtreeNodeIds: (startNodeId: string) => Set<string>;
  collapseByEdge: (targetId: string, sourceId: string) => void;
  unfoldSubtree: (subtreeNodeIds: Set<string>) => void;
}

export function applyFoldForEdgeWithController(edge: Edge, params: FoldControllerParams) {
  const foldResolution = resolveFoldEdge(edge, params.nodesById, params.hiddenNodeIds);
  if (!foldResolution) {
    return false;
  }
  if (params.collapsedTargets.has(foldResolution.targetId)) {
    params.unfoldSubtree(params.getSubtreeNodeIds(foldResolution.targetId));
    return true;
  }
  params.collapseByEdge(foldResolution.targetId, foldResolution.sourceId);
  return true;
}

export function applyFoldForNodeWithController(
  nodeId: string,
  edges: Edge[],
  applyFoldForEdge: (edge: Edge) => boolean
) {
  const outgoing = edges.filter((edge) => edge.source === nodeId);
  if (outgoing.length === 0) {
    return false;
  }
  for (const edge of outgoing) {
    applyFoldForEdge(edge);
  }
  return true;
}

