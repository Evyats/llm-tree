import type { Edge, Node } from "reactflow";

import type { NodeData } from "../../store/useGraphStore";
import type { EdgeAppearance } from "./edgeStyles";
import { styleEdgeWithAppearance } from "./edgeStyles";

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
    for (const id of getSubtreeNodeIds(targetId)) {
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
  edges: Edge[],
  hiddenNodeIds: Set<string>,
  collapsedProxyTargets: string[],
  collapsedEdgeSources: Map<string, string>,
  collapsedPrefix: string
) {
  const edgeParentByTarget = new Map<string, string>();
  for (const edge of edges) {
    if (!edgeParentByTarget.has(edge.target)) {
      edgeParentByTarget.set(edge.target, edge.source);
    }
  }
  const proxyTargetSet = new Set(collapsedProxyTargets);
  const ordered: Node<NodeData>[] = [];
  for (const node of nodes) {
    if (proxyTargetSet.has(node.id)) {
      const parentId = node.data.parentId ?? edgeParentByTarget.get(node.id) ?? null;
      const collapsedParentId = collapsedEdgeSources.get(node.id) ?? parentId;
      ordered.push({
        id: `${collapsedPrefix}${node.id}`,
        type: "collapsedNode",
        position: node.position,
        data: {
          role: node.data.role,
          parentId: collapsedParentId,
          text: "Folded",
          variants: null,
          variantIndex: 0,
          mode: "normal",
          highlightedText: null,
        },
      });
      continue;
    }
    if (!hiddenNodeIds.has(node.id)) {
      ordered.push(node);
    }
  }
  return ordered;
}

export function buildLayoutNodeSizes(
  nodeSizes: Map<string, { width: number; height: number }>,
  collapsedProxyTargets: string[],
  collapsedPrefix: string,
  collapsedSize: { width: number; minHeight: number }
) {
  const next = new Map(nodeSizes);
  for (const targetId of collapsedProxyTargets) {
    next.set(`${collapsedPrefix}${targetId}`, { width: collapsedSize.width, height: collapsedSize.minHeight });
  }
  return next;
}

export function buildProjectedUiEdges(
  edges: Edge[],
  hiddenNodeIds: Set<string>,
  collapsedProxyTargets: string[],
  collapsedEdgeSources: Map<string, string>,
  nodesById: Map<string, Node<NodeData>>,
  collapsedPrefix: string,
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

  const edgeParentByTarget = new Map<string, string>();
  for (const edge of edges) {
    if (!edgeParentByTarget.has(edge.target)) {
      edgeParentByTarget.set(edge.target, edge.source);
    }
  }

  const collapsedEdges = collapsedProxyTargets
    .map((targetId) => {
      const sourceId =
        collapsedEdgeSources.get(targetId) ??
        edgeParentByTarget.get(targetId) ??
        nodesById.get(targetId)?.data.parentId ??
        null;
      if (!sourceId || hiddenNodeIds.has(sourceId)) {
        return null;
      }
      return styleEdge({
        id: `collapsed-edge:${sourceId}->${targetId}`,
        source: sourceId,
        target: `${collapsedPrefix}${targetId}`,
      });
    })
    .filter((edge): edge is Edge => edge !== null);

  const deduped = new Map<string, Edge>();
  for (const edge of [...baseEdges, ...collapsedEdges]) {
    deduped.set(edge.id, edge);
  }
  return Array.from(deduped.values());
}

export function isFoldableEdge(
  edge: Edge,
  nodesById: Map<string, Node<NodeData>>,
  hiddenNodeIds: Set<string>
) {
  if (edge.id.startsWith("collapsed-edge:")) {
    return false;
  }
  if (hiddenNodeIds.has(edge.target)) {
    return false;
  }
  return nodesById.get(edge.source)?.data.role === "assistant";
}
