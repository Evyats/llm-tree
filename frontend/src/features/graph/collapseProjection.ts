import type { Edge, Node } from "reactflow";

import type { NodeData } from "../../store/useGraphStore";
import type { EdgeAppearance } from "./edgeStyles";
import { styleEdgeWithAppearance } from "./edgeStyles";

interface FoldEdgeResolution {
  sourceId: string;
  targetId: string;
}

export function buildChildrenBySource(edges: Edge[]) {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    const list = map.get(edge.source) ?? [];
    list.push(edge.target);
    map.set(edge.source, list);
  }
  return map;
}

export function collectSubtreeNodeIds(startNodeId: string, childrenByNodeId: Map<string, string[]>) {
  const ids = new Set<string>();
  const stack = [startNodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (ids.has(current)) continue;
    ids.add(current);
    const children = childrenByNodeId.get(current) ?? [];
    for (const child of children) {
      stack.push(child);
    }
  }
  return ids;
}

export function buildHiddenNodeIds(
  collapsedTargets: Set<string>,
  getSubtreeNodeIds: (startNodeId: string) => Set<string>
) {
  const hidden = new Set<string>();
  for (const targetId of collapsedTargets) {
    const subtree = getSubtreeNodeIds(targetId);
    for (const id of subtree) {
      if (id === targetId) {
        continue;
      }
      hidden.add(id);
    }
  }
  return hidden;
}

export function buildCollapsedProxyTargets(
  collapsedTargets: Set<string>,
  hiddenNodeIds: Set<string>,
  nodesById: Map<string, Node<NodeData>>
) {
  const visibleProxies: string[] = [];
  for (const targetId of collapsedTargets) {
    const targetNode = nodesById.get(targetId);
    if (!targetNode) continue;
    const parentId = targetNode.data.parentId;
    if (parentId && hiddenNodeIds.has(parentId)) {
      continue;
    }
    visibleProxies.push(targetId);
  }
  return visibleProxies;
}

export function pruneCollapsedTargets(nodes: Node<NodeData>[], collapsedTargets: Set<string>) {
  if (collapsedTargets.size === 0) {
    return collapsedTargets;
  }
  const existingNodeIds = new Set(nodes.map((node) => node.id));
  const next = new Set<string>();
  for (const id of collapsedTargets) {
    if (existingNodeIds.has(id)) {
      next.add(id);
    }
  }
  return next;
}

export function pruneCollapsedEdgeSources(
  nodes: Node<NodeData>[],
  collapsedTargets: Set<string>,
  collapsedEdgeSources: Map<string, string>
) {
  const existingNodeIds = new Set(nodes.map((node) => node.id));
  const next = new Map<string, string>();
  for (const [targetId, sourceId] of collapsedEdgeSources) {
    if (!existingNodeIds.has(targetId) || !existingNodeIds.has(sourceId) || !collapsedTargets.has(targetId)) {
      continue;
    }
    next.set(targetId, sourceId);
  }
  return next;
}

export function buildLayoutNodes(
  nodes: Node<NodeData>[],
  hiddenNodeIds: Set<string>,
  collapsedProxyTargets: string[]
) {
  const proxyTargetSet = new Set(collapsedProxyTargets);
  const ordered: Node<NodeData>[] = [];
  for (const node of nodes) {
    if (hiddenNodeIds.has(node.id)) {
      continue;
    }
    if (proxyTargetSet.has(node.id)) {
      ordered.push({
        ...node,
        type: "collapsedNode",
        data: {
          ...node.data,
        },
      });
      continue;
    }
    ordered.push(node);
  }
  return ordered;
}

export function buildLayoutNodeSizes(
  nodeSizes: Map<string, { width: number; height: number }>,
  collapsedProxyTargets: string[],
  collapsedSize: { width: number; minHeight: number }
) {
  const next = new Map(nodeSizes);
  for (const targetId of collapsedProxyTargets) {
    next.set(targetId, { width: collapsedSize.width, height: collapsedSize.minHeight });
  }
  return next;
}

export function buildProjectedUiEdges(
  edges: Edge[],
  hiddenNodeIds: Set<string>,
  nodesById: Map<string, Node<NodeData>>,
  userAppearance: EdgeAppearance,
  assistantAppearance: EdgeAppearance
) {
  const styleEdge = (edge: Edge): Edge => {
    const sourceRole = nodesById.get(edge.source)?.data.role ?? "assistant";
    const appearance = sourceRole === "user" ? userAppearance : assistantAppearance;
    return styleEdgeWithAppearance(edge, appearance);
  };

  const visibleEdges = edges.filter((edge) => !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target));
  const baseEdges = visibleEdges.map(styleEdge);

  const deduped = new Map<string, Edge>();
  for (const edge of baseEdges) {
    deduped.set(edge.id, edge);
  }
  return Array.from(deduped.values());
}

export function isFoldableEdge(
  edge: Edge,
  nodesById: Map<string, Node<NodeData>>,
  hiddenNodeIds: Set<string>
) {
  return resolveFoldEdge(edge, nodesById, hiddenNodeIds) !== null;
}

export function resolveFoldEdge(
  edge: Edge,
  nodesById: Map<string, Node<NodeData>>,
  hiddenNodeIds: Set<string>
): FoldEdgeResolution | null {
  if (edge.id.startsWith("collapsed-edge:")) {
    return null;
  }
  if (hiddenNodeIds.has(edge.target)) {
    return null;
  }
  const sourceNode = nodesById.get(edge.source);
  if (!sourceNode) {
    return null;
  }

  if (sourceNode.data.role === "assistant") {
    return { sourceId: edge.source, targetId: edge.target };
  }
  if (sourceNode.data.role !== "user") {
    return null;
  }

  // For user-origin edges, resolve to the equivalent assistant-anchored branch:
  // walk up consecutive user parents until reaching the assistant parent.
  let cursor: Node<NodeData> | undefined = sourceNode;
  let firstUserAfterAssistant: Node<NodeData> | null = sourceNode;
  let topMostUserInChain: Node<NodeData> = sourceNode;
  while (cursor) {
    const parentId = cursor.data.parentId;
    if (!parentId) {
      return { sourceId: topMostUserInChain.id, targetId: topMostUserInChain.id };
    }
    const parent = nodesById.get(parentId);
    if (!parent) {
      return { sourceId: topMostUserInChain.id, targetId: topMostUserInChain.id };
    }
    if (parent.data.role === "assistant") {
      if (!firstUserAfterAssistant || hiddenNodeIds.has(firstUserAfterAssistant.id)) {
        return null;
      }
      return { sourceId: parent.id, targetId: firstUserAfterAssistant.id };
    }
    if (parent.data.role !== "user") {
      return { sourceId: topMostUserInChain.id, targetId: topMostUserInChain.id };
    }
    firstUserAfterAssistant = parent;
    topMostUserInChain = parent;
    cursor = parent;
  }
  return null;
}
