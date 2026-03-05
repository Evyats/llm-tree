import type { Edge, Node } from "reactflow";
import type { NodeData } from "../../store/useGraphStore";
import { edgePayloadToFlowEdge, nodePayloadToFlowNode } from "../../store/mappers";
import type { ContinueResponse } from "./types";

export interface OptimisticBranchIds {
  tempUserId: string;
  tempAssistantId: string;
  tempUserEdgeId: string;
  tempAssistantEdgeId: string;
}

export interface OptimisticBranchResult {
  nodes: Node<NodeData>[];
  edges: Edge[];
  ids: OptimisticBranchIds;
}

export function buildOptimisticBranch(
  baseNodes: Node<NodeData>[],
  baseEdges: Edge[],
  parentNodeId: string | null,
  userText: string,
  baseX: number,
  baseY: number,
  idFactory: () => string,
  mode: "normal" | "elaboration"
): OptimisticBranchResult {
  const ids: OptimisticBranchIds = {
    tempUserId: idFactory(),
    tempAssistantId: idFactory(),
    tempUserEdgeId: idFactory(),
    tempAssistantEdgeId: idFactory(),
  };
  const nodes: Node<NodeData>[] = [
    ...baseNodes,
    {
      id: ids.tempUserId,
      type: "userNode",
      position: { x: baseX, y: baseY },
      data: {
        role: "user",
        parentId: parentNodeId,
        text: userText,
        variants: null,
        variantIndex: 0,
        mode,
        highlightedText: null,
      },
    },
    {
      id: ids.tempAssistantId,
      type: "assistantNode",
      position: { x: baseX, y: baseY + 170 },
      data: {
        role: "assistant",
        parentId: ids.tempUserId,
        text: "",
        variants: null,
        variantIndex: 0,
        mode: "normal",
        highlightedText: null,
        pending: true,
      },
    },
  ];

  const edges: Edge[] = [
    ...baseEdges,
    ...(parentNodeId
      ? [{ id: ids.tempUserEdgeId, source: parentNodeId, target: ids.tempUserId, type: "straight" } as Edge]
      : []),
    { id: ids.tempAssistantEdgeId, source: ids.tempUserId, target: ids.tempAssistantId, type: "straight" } as Edge,
  ];

  return { nodes, edges, ids };
}

export function reconcileOptimisticBranch(
  optimisticNodes: Node<NodeData>[],
  optimisticEdges: Edge[],
  response: ContinueResponse,
  ids: OptimisticBranchIds
) {
  const nodes = optimisticNodes
    .filter((node) => node.id !== ids.tempUserId && node.id !== ids.tempAssistantId)
    .concat([nodePayloadToFlowNode(response.created_user_node), nodePayloadToFlowNode(response.created_assistant_node)]);
  const edges = optimisticEdges
    .filter((edge) => edge.id !== ids.tempUserEdgeId && edge.id !== ids.tempAssistantEdgeId)
    .concat(response.created_edges.map(edgePayloadToFlowEdge));
  return { nodes, edges };
}

export function isOptimisticBranchStillRelevant(
  currentNodes: Node<NodeData>[],
  ids: Pick<OptimisticBranchIds, "tempUserId" | "tempAssistantId">
) {
  const currentIds = new Set(currentNodes.map((node) => node.id));
  return currentIds.has(ids.tempUserId) && currentIds.has(ids.tempAssistantId);
}

