import { useEffect } from "react";

import { createGraph, getGraph } from "../../api/client";
import { GRAPH_STORAGE_KEY } from "../layout/constants";

interface UseGraphBootstrapParams {
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
  setGraph: (graphId: string, title: string, titleState: string, nodes: any[], edges: any[]) => void;
  applyCollapsedState: (collapsedTargets: string[], collapsedEdgeSources: Record<string, string>) => void;
  fitCanvasToGraph: () => void;
  refreshGraphList: () => Promise<void>;
}

export function useGraphBootstrap({
  setLoading,
  setError,
  setGraph,
  applyCollapsedState,
  fitCanvasToGraph,
  refreshGraphList,
}: UseGraphBootstrapParams) {
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        const persistedGraph = localStorage.getItem(GRAPH_STORAGE_KEY);
        if (persistedGraph) {
          const graph = await getGraph(persistedGraph);
          setGraph(graph.graph_id, graph.title, graph.title_state, graph.nodes, graph.edges);
          applyCollapsedState(
            graph.collapsed_state?.collapsed_targets ?? [],
            graph.collapsed_state?.collapsed_edge_sources ?? {}
          );
          fitCanvasToGraph();
          await refreshGraphList();
          return;
        }
        const created = await createGraph("Chat Tree");
        localStorage.setItem(GRAPH_STORAGE_KEY, created.graph_id);
        const graph = await getGraph(created.graph_id);
        setGraph(graph.graph_id, graph.title, graph.title_state, graph.nodes, graph.edges);
        applyCollapsedState(
          graph.collapsed_state?.collapsed_targets ?? [],
          graph.collapsed_state?.collapsed_edge_sources ?? {}
        );
        fitCanvasToGraph();
        await refreshGraphList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize graph");
      } finally {
        setLoading(false);
      }
    };
    void initialize();
  }, [applyCollapsedState, fitCanvasToGraph, refreshGraphList, setError, setGraph, setLoading]);
}
