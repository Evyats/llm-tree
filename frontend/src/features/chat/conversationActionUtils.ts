import type { Edge, Node } from "reactflow";

import type { NodeData } from "../../store/useGraphStore";

export function createTempId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `temp-${crypto.randomUUID()}`
    : `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createFallbackDelayWaiter(selectedModel: string, fallbackDelayMs: number) {
  return async () => {
    if (selectedModel !== "fallback" || fallbackDelayMs <= 0) {
      return;
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, fallbackDelayMs));
  };
}

export function createPersistedAnchorResolver(nodesById: Map<string, Node<NodeData>>) {
  return (startId: string | null): string | null => {
    let cursor = startId;
    const seen = new Set<string>();
    while (cursor) {
      if (seen.has(cursor)) {
        return null;
      }
      seen.add(cursor);
      if (!cursor.startsWith("temp-")) {
        return cursor;
      }
      cursor = nodesById.get(cursor)?.data.parentId ?? null;
    }
    return null;
  };
}

export function isPendingAssistantAnchor(nodesById: Map<string, Node<NodeData>>, nodeId: string | null) {
  if (!nodeId) {
    return false;
  }
  const node = nodesById.get(nodeId);
  return node?.data.role === "assistant" && node.data.pending === true;
}

export function pruneAssistantVariantsInNodes(items: Node<NodeData>[], nodeId: string | null) {
  if (!nodeId) {
    return items;
  }
  return items.map((node) => {
    if (node.id !== nodeId || node.data.role !== "assistant") {
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        variants: null,
        variantIndex: 0,
        variantLocked: true,
      },
    };
  });
}

export function buildOptimisticStartPosition(
  nodesById: Map<string, Node<NodeData>>,
  anchorNodeId: string | null
) {
  const parentPos = anchorNodeId ? nodesById.get(anchorNodeId)?.position : null;
  return {
    baseX: parentPos?.x ?? 0,
    baseY: (parentPos?.y ?? 80) + 170,
  };
}

export function restoreDraftIfStillEmpty(
  draftRef: { current: string },
  previousDraft: string,
  setDraft: (value: string) => void
) {
  if (draftRef.current.trim().length === 0) {
    draftRef.current = previousDraft;
    setDraft(previousDraft);
  }
}

export function buildOptimisticRelevanceGuard(
  getLatestNodes: () => Node<NodeData>[],
  tempUserId: string,
  tempAssistantId: string
) {
  return () =>
    getLatestNodes().some((node) => node.id === tempUserId) &&
    getLatestNodes().some((node) => node.id === tempAssistantId);
}

export function appendUserLine(
  transcript: Array<{ role: "user" | "assistant"; content: string }>,
  userText: string
) {
  return [
    ...transcript,
    {
      role: "user" as const,
      content: userText,
    },
  ];
}
