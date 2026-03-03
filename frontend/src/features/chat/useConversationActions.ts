import { useCallback } from "react";
import type { Node } from "reactflow";

import { continueFromNode, continueInPanel } from "../../api/client";
import { getContinueFromVariantIndex } from "../graph/nodeSelectors";
import type { NodeData } from "../../store/useGraphStore";

interface UseConversationActionsParams {
  graphId: string | null;
  selectedNodeId: string | null;
  panelAnchorNodeId: string | null;
  composerText: string;
  panelText: string;
  nodesById: Map<string, Node<NodeData>>;
  appendEntities: (nodes: any[], edges: any[]) => void;
  refreshGraphList: () => Promise<void>;
  setSelectedNode: (id: string | null) => void;
  setResponseSource: (value: "live" | "fallback" | null) => void;
  setTranscript: (value: Array<{ role: "user" | "assistant"; content: string }>) => void;
  setComposerText: (value: string) => void;
  setPanelText: (value: string) => void;
  setPanelAnchorNodeId: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
  clearElaborateAction: () => void;
}

export function useConversationActions({
  graphId,
  selectedNodeId,
  panelAnchorNodeId,
  composerText,
  panelText,
  nodesById,
  appendEntities,
  refreshGraphList,
  setSelectedNode,
  setResponseSource,
  setTranscript,
  setComposerText,
  setPanelText,
  setPanelAnchorNodeId,
  setLoading,
  setError,
  clearElaborateAction,
}: UseConversationActionsParams) {
  const sendContinue = useCallback(
    async (mode: "normal" | "elaboration", highlightedText?: string) => {
      if (!graphId) return;
      const userText = mode === "elaboration" ? "Elaborate on this specific point." : composerText.trim();
      if (!userText) return;
      try {
        setLoading(true);
        setError(null);
        const continueFromNodeId = selectedNodeId ?? null;
        const response = await continueFromNode({
          graph_id: graphId,
          continue_from_node_id: continueFromNodeId,
          continue_from_variant_index: getContinueFromVariantIndex(nodesById, continueFromNodeId),
          user_text: userText,
          mode,
          highlighted_text: highlightedText ?? null,
        });
        appendEntities([response.created_user_node, response.created_assistant_node], response.created_edges);
        setSelectedNode(response.created_assistant_node.id);
        setResponseSource(response.response_source);
        setTranscript(response.transcript_window);
        setComposerText("");
        clearElaborateAction();
        await refreshGraphList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to continue conversation");
      } finally {
        setLoading(false);
      }
    },
    [
      appendEntities,
      composerText,
      graphId,
      nodesById,
      refreshGraphList,
      selectedNodeId,
      setComposerText,
      clearElaborateAction,
      setError,
      setLoading,
      setResponseSource,
      setSelectedNode,
      setTranscript,
    ]
  );

  const sendPanelContinue = useCallback(async () => {
    if (!graphId || !panelAnchorNodeId) return;
    if (!panelText.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const response = await continueInPanel({
        graph_id: graphId,
        anchor_node_id: panelAnchorNodeId,
        anchor_variant_index: getContinueFromVariantIndex(nodesById, panelAnchorNodeId),
        user_text: panelText.trim(),
      });
      appendEntities([response.created_user_node, response.created_assistant_node], response.created_edges);
      setPanelAnchorNodeId(response.created_assistant_node.id);
      setSelectedNode(response.created_assistant_node.id);
      setTranscript(response.transcript_window);
      setResponseSource(response.response_source);
      setPanelText("");
      await refreshGraphList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue in panel");
    } finally {
      setLoading(false);
    }
  }, [
    appendEntities,
    graphId,
    nodesById,
    panelAnchorNodeId,
    panelText,
    refreshGraphList,
    setError,
    setLoading,
    setPanelAnchorNodeId,
    setPanelText,
    setResponseSource,
    setSelectedNode,
    setTranscript,
  ]);

  return {
    sendContinue,
    sendPanelContinue,
  };
}
