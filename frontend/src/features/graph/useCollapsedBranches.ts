import { useCallback, useState } from "react";

export function useCollapsedBranches() {
  const [collapsedTargets, setCollapsedTargets] = useState<Set<string>>(new Set());
  const [collapsedEdgeSources, setCollapsedEdgeSources] = useState<Map<string, string>>(new Map());

  const resetCollapsed = useCallback(() => {
    setCollapsedTargets(new Set());
    setCollapsedEdgeSources(new Map());
  }, []);

  const collapseByEdge = useCallback((targetId: string, sourceId: string) => {
    setCollapsedTargets((prev) => {
      if (prev.has(targetId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(targetId);
      return next;
    });
    setCollapsedEdgeSources((prev) => {
      const next = new Map(prev);
      next.set(targetId, sourceId);
      return next;
    });
  }, []);

  const unfoldSubtree = useCallback((subtreeNodeIds: Set<string>) => {
    setCollapsedTargets((prev) => {
      const next = new Set(prev);
      for (const id of subtreeNodeIds) {
        next.delete(id);
      }
      return next;
    });
    setCollapsedEdgeSources((prev) => {
      const next = new Map(prev);
      for (const id of subtreeNodeIds) {
        next.delete(id);
      }
      return next;
    });
  }, []);

  return {
    collapsedTargets,
    collapsedEdgeSources,
    setCollapsedTargets,
    setCollapsedEdgeSources,
    resetCollapsed,
    collapseByEdge,
    unfoldSubtree,
  };
}
