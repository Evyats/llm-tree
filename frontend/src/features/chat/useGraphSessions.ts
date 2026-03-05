import { useCallback, useState } from "react";

import {
  createGraph,
  deleteAllGraphs,
  deleteGraph,
  getGraph,
  listGraphs,
  renameGraph,
} from "../../api/client";
import type { ChatSummary } from "../../api/types";
import type { TranscriptLine } from "./types";
import { GRAPH_STORAGE_KEY } from "../layout/constants";

interface UseGraphSessionsParams {
  graphId: string | null;
  nodesCount: number;
  setGraph: (graphId: string, title: string, nodes: any[], edges: any[]) => void;
  setPanelOpen: (open: boolean) => void;
  setPanelAnchorNodeId: (nodeId: string | null) => void;
  setComposerText: (value: string) => void;
  setPanelText: (value: string) => void;
  setElaborateAction: (value: any) => void;
  setResponseSource: (value: "live" | "fallback" | null) => void;
  setTranscript: (value: TranscriptLine[]) => void;
  setError: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  setMobileHistoryOpen: (open: boolean) => void;
  fitCanvasToGraph: () => void;
}

export function useGraphSessions({
  graphId,
  nodesCount,
  setGraph,
  setPanelOpen,
  setPanelAnchorNodeId,
  setComposerText,
  setPanelText,
  setElaborateAction,
  setResponseSource,
  setTranscript,
  setError,
  setLoading,
  setMobileHistoryOpen,
  fitCanvasToGraph,
}: UseGraphSessionsParams) {
  const [previousChats, setPreviousChats] = useState<ChatSummary[]>([]);

  const findReusableEmptyGraphId = useCallback(async (): Promise<string | null> => {
    if (graphId && nodesCount === 0) {
      return graphId;
    }
    const candidates = previousChats
      .filter((chat) => chat.graph_id !== graphId)
      .map((chat) => chat.graph_id);
    for (const candidateId of candidates) {
      try {
        const graph = await getGraph(candidateId);
        if (graph.nodes.length === 0) {
          return candidateId;
        }
      } catch {
        // ignore candidate fetch failures and continue
      }
    }
    return null;
  }, [graphId, nodesCount, previousChats]);

  const refreshGraphList = useCallback(async () => {
    try {
      const items = await listGraphs();
      setPreviousChats(items);
    } catch {
      // Non-blocking panel data.
    }
  }, []);

  const loadGraph = useCallback(
    async (targetGraphId: string) => {
      const graph = await getGraph(targetGraphId);
      localStorage.setItem(GRAPH_STORAGE_KEY, targetGraphId);
      setGraph(graph.graph_id, graph.title, graph.nodes, graph.edges);
      fitCanvasToGraph();
      setMobileHistoryOpen(false);
      setPanelOpen(false);
      setPanelAnchorNodeId(null);
      setError(null);
    },
    [fitCanvasToGraph, setError, setGraph, setMobileHistoryOpen, setPanelAnchorNodeId, setPanelOpen]
  );

  const startNewChat = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const reusableEmptyGraphId = await findReusableEmptyGraphId();
      if (reusableEmptyGraphId) {
        await loadGraph(reusableEmptyGraphId);
      } else {
        const created = await createGraph("Chat Tree");
        localStorage.setItem(GRAPH_STORAGE_KEY, created.graph_id);
        const graph = await getGraph(created.graph_id);
        setGraph(graph.graph_id, graph.title, graph.nodes, graph.edges);
      }
      fitCanvasToGraph();
      setComposerText("");
      setPanelText("");
      setPanelOpen(false);
      setPanelAnchorNodeId(null);
      setElaborateAction(null);
      setResponseSource(null);
      setTranscript([]);
      await refreshGraphList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start new chat");
    } finally {
      setLoading(false);
    }
  }, [
    findReusableEmptyGraphId,
    fitCanvasToGraph,
    loadGraph,
    refreshGraphList,
    setComposerText,
    setElaborateAction,
    setError,
    setGraph,
    setLoading,
    setPanelAnchorNodeId,
    setPanelOpen,
    setPanelText,
    setResponseSource,
    setTranscript,
  ]);

  const selectChatFromHistory = useCallback(
    async (targetGraphId: string) => {
      if (graphId === targetGraphId) {
        setPanelOpen(false);
        setPanelAnchorNodeId(null);
        return;
      }
      try {
        setLoading(true);
        setPanelOpen(false);
        setPanelAnchorNodeId(null);
        await loadGraph(targetGraphId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chat");
      } finally {
        setLoading(false);
      }
    },
    [graphId, loadGraph, setError, setLoading, setPanelAnchorNodeId, setPanelOpen]
  );

  const handleRenameChat = useCallback(
    async (chat: ChatSummary) => {
      const nextTitle = window.prompt("Rename chat", chat.title || "Untitled Chat");
      if (nextTitle === null) return;
      try {
        setLoading(true);
        await renameGraph(chat.graph_id, nextTitle);
        if (graphId === chat.graph_id) {
          await loadGraph(chat.graph_id);
        }
        await refreshGraphList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename chat");
      } finally {
        setLoading(false);
      }
    },
    [graphId, loadGraph, refreshGraphList, setError, setLoading]
  );

  const handleDeleteChat = useCallback(
    async (chat: ChatSummary) => {
      if (!window.confirm("Delete this chat?")) return;
      try {
        setLoading(true);
        await deleteGraph(chat.graph_id);
        if (graphId === chat.graph_id) {
          const remaining = previousChats.filter((item) => item.graph_id !== chat.graph_id);
          if (remaining.length > 0) {
            await loadGraph(remaining[0].graph_id);
          } else {
            const created = await createGraph("Chat Tree");
            await loadGraph(created.graph_id);
          }
        }
        await refreshGraphList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete chat");
      } finally {
        setLoading(false);
      }
    },
    [graphId, loadGraph, previousChats, refreshGraphList, setError, setLoading]
  );

  const handleDeleteAllChats = useCallback(async () => {
    if (!window.confirm("Delete all chats?")) return;
    try {
      setLoading(true);
      await deleteAllGraphs();
      const created = await createGraph("Chat Tree");
      await loadGraph(created.graph_id);
      await refreshGraphList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete all chats");
    } finally {
      setLoading(false);
    }
  }, [loadGraph, refreshGraphList, setError, setLoading]);

  return {
    previousChats,
    setPreviousChats,
    refreshGraphList,
    loadGraph,
    startNewChat,
    selectChatFromHistory,
    handleRenameChat,
    handleDeleteChat,
    handleDeleteAllChats,
  };
}
