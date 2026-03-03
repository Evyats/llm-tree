import { useEffect } from "react";

import { createGraph, getGraph } from "../../api/client";
import { GRAPH_STORAGE_KEY } from "../layout/constants";

interface UseGraphBootstrapParams {
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
  setGraph: (graphId: string, title: string, nodes: any[], edges: any[]) => void;
  fitCanvasToGraph: () => void;
  refreshGraphList: () => Promise<void>;
}

export function useGraphBootstrap({
  setLoading,
  setError,
  setGraph,
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
          setGraph(graph.graph_id, graph.title, graph.nodes, graph.edges);
          fitCanvasToGraph();
          await refreshGraphList();
          return;
        }
        const created = await createGraph("Chat Tree");
        localStorage.setItem(GRAPH_STORAGE_KEY, created.graph_id);
        const graph = await getGraph(created.graph_id);
        setGraph(graph.graph_id, graph.title, graph.nodes, graph.edges);
        fitCanvasToGraph();
        await refreshGraphList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize graph");
      } finally {
        setLoading(false);
      }
    };
    void initialize();
  }, [fitCanvasToGraph, refreshGraphList, setError, setGraph, setLoading]);
}
