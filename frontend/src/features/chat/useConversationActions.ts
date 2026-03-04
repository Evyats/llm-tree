import { useCallback } from "react";
import type { Node } from "reactflow";

import { continueFromNode, continueInPanel } from "../../api/client";
import { getContinueFromVariantIndex } from "../graph/nodeSelectors";
import type { NodeData } from "../../store/useGraphStore";
import { edgePayloadToFlowEdge, nodePayloadToFlowNode } from "../../store/mappers";
import type { Edge } from "reactflow";

interface UseConversationActionsParams {
  graphId: string | null;
  selectedNodeId: string | null;
  panelAnchorNodeId: string | null;
  composerText: string;
  panelText: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodesById: Map<string, Node<NodeData>>;
  refreshGraphList: () => Promise<void>;
  setSelectedNode: (id: string | null) => void;
  setResponseSource: (value: "live" | "fallback" | null) => void;
  setTranscript: (value: Array<{ role: "user" | "assistant"; content: string }>) => void;
  setComposerText: (value: string) => void;
  setPanelText: (value: string) => void;
  setPanelAnchorNodeId: (value: string | null) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
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
  nodes,
  edges,
  nodesById,
  refreshGraphList,
  setSelectedNode,
  setResponseSource,
  setTranscript,
  setComposerText,
  setPanelText,
  setPanelAnchorNodeId,
  setNodes,
  setEdges,
  setLoading,
  setError,
  clearElaborateAction,
}: UseConversationActionsParams) {
  const generateTempId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `temp-${crypto.randomUUID()}`
      : `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const sendContinue = useCallback(
    async (mode: "normal" | "elaboration", highlightedText?: string) => {
      if (!graphId) return;
      const elaborationBase = highlightedText?.trim() ?? "";
      const elaborationText = elaborationBase
        ? `${elaborationBase}${elaborationBase.endsWith("?") ? "" : "?"}`
        : "";
      const userText = mode === "elaboration" ? elaborationText : composerText.trim();
      if (!userText) return;
      const continueFromNodeId = selectedNodeId ?? null;
      const parentPos = continueFromNodeId ? nodesById.get(continueFromNodeId)?.position : null;
      const baseX = parentPos?.x ?? 0;
      const baseY = (parentPos?.y ?? 80) + 170;
      const tempUserId = generateTempId();
      const tempAssistantId = generateTempId();
      const tempUserEdgeId = generateTempId();
      const tempAssistantEdgeId = generateTempId();
      const optimisticNodes: Node<NodeData>[] = [
        ...nodes,
        {
          id: tempUserId,
          type: "userNode",
          position: { x: baseX, y: baseY },
          data: {
            role: "user",
            parentId: continueFromNodeId,
            text: userText,
            variants: null,
            variantIndex: 0,
            mode,
            highlightedText: highlightedText ?? null,
          },
        },
        {
          id: tempAssistantId,
          type: "assistantNode",
          position: { x: baseX, y: baseY + 170 },
          data: {
            role: "assistant",
            parentId: tempUserId,
            text: "",
            variants: null,
            variantIndex: 0,
            mode: "normal",
            highlightedText: null,
            pending: true,
          },
        },
      ];
      const optimisticEdges: Edge[] = [
        ...edges,
        ...(continueFromNodeId
          ? [
              {
                id: tempUserEdgeId,
                source: continueFromNodeId,
                target: tempUserId,
                type: "straight",
              } as Edge,
            ]
          : []),
        {
          id: tempAssistantEdgeId,
          source: tempUserId,
          target: tempAssistantId,
          type: "straight",
        } as Edge,
      ];
      try {
        setLoading(true);
        setError(null);
        setNodes(optimisticNodes);
        setEdges(optimisticEdges);
        setSelectedNode(tempAssistantId);
        const response = await continueFromNode({
          graph_id: graphId,
          continue_from_node_id: continueFromNodeId,
          continue_from_variant_index: getContinueFromVariantIndex(nodesById, continueFromNodeId),
          user_text: userText,
          mode,
          highlighted_text: highlightedText ?? null,
        });
        const nextNodes = optimisticNodes
          .filter((node) => node.id !== tempUserId && node.id !== tempAssistantId)
          .concat([nodePayloadToFlowNode(response.created_user_node), nodePayloadToFlowNode(response.created_assistant_node)]);
        const nextEdges = optimisticEdges
          .filter((edge) => edge.id !== tempUserEdgeId && edge.id !== tempAssistantEdgeId)
          .concat(response.created_edges.map(edgePayloadToFlowEdge));
        setNodes(nextNodes);
        setEdges(nextEdges);
        setSelectedNode(response.created_assistant_node.id);
        setResponseSource(response.response_source);
        setTranscript(response.transcript_window);
        setComposerText("");
        clearElaborateAction();
        await refreshGraphList();
      } catch (err) {
        setNodes(nodes);
        setEdges(edges);
        setError(err instanceof Error ? err.message : "Failed to continue conversation");
      } finally {
        setLoading(false);
      }
    },
    [
      composerText,
      edges,
      graphId,
      nodes,
      nodesById,
      refreshGraphList,
      selectedNodeId,
      setComposerText,
      setEdges,
      clearElaborateAction,
      setError,
      setLoading,
      setNodes,
      setResponseSource,
      setSelectedNode,
      setTranscript,
    ]
  );

  const sendPanelContinue = useCallback(async () => {
    if (!graphId || !panelAnchorNodeId) return;
    if (!panelText.trim()) return;
    const anchorPos = nodesById.get(panelAnchorNodeId)?.position;
    const baseX = anchorPos?.x ?? 0;
    const baseY = (anchorPos?.y ?? 80) + 170;
    const userText = panelText.trim();
    const tempUserId = generateTempId();
    const tempAssistantId = generateTempId();
    const tempUserEdgeId = generateTempId();
    const tempAssistantEdgeId = generateTempId();
    const optimisticNodes: Node<NodeData>[] = [
      ...nodes,
      {
        id: tempUserId,
        type: "userNode",
        position: { x: baseX, y: baseY },
        data: {
          role: "user",
          parentId: panelAnchorNodeId,
          text: userText,
          variants: null,
          variantIndex: 0,
          mode: "normal",
          highlightedText: null,
        },
      },
      {
        id: tempAssistantId,
        type: "assistantNode",
        position: { x: baseX, y: baseY + 170 },
        data: {
          role: "assistant",
          parentId: tempUserId,
          text: "",
          variants: null,
          variantIndex: 0,
          mode: "normal",
          highlightedText: null,
          pending: true,
        },
      },
    ];
    const optimisticEdges: Edge[] = [
      ...edges,
      {
        id: tempUserEdgeId,
        source: panelAnchorNodeId,
        target: tempUserId,
        type: "straight",
      } as Edge,
      {
        id: tempAssistantEdgeId,
        source: tempUserId,
        target: tempAssistantId,
        type: "straight",
      } as Edge,
    ];
    try {
      setLoading(true);
      setError(null);
      setNodes(optimisticNodes);
      setEdges(optimisticEdges);
      setSelectedNode(tempAssistantId);
      const response = await continueInPanel({
        graph_id: graphId,
        anchor_node_id: panelAnchorNodeId,
        anchor_variant_index: getContinueFromVariantIndex(nodesById, panelAnchorNodeId),
        user_text: userText,
      });
      const nextNodes = optimisticNodes
        .filter((node) => node.id !== tempUserId && node.id !== tempAssistantId)
        .concat([nodePayloadToFlowNode(response.created_user_node), nodePayloadToFlowNode(response.created_assistant_node)]);
      const nextEdges = optimisticEdges
        .filter((edge) => edge.id !== tempUserEdgeId && edge.id !== tempAssistantEdgeId)
        .concat(response.created_edges.map(edgePayloadToFlowEdge));
      setNodes(nextNodes);
      setEdges(nextEdges);
      setPanelAnchorNodeId(response.created_assistant_node.id);
      setSelectedNode(response.created_assistant_node.id);
      setTranscript(response.transcript_window);
      setResponseSource(response.response_source);
      setPanelText("");
      await refreshGraphList();
    } catch (err) {
      setNodes(nodes);
      setEdges(edges);
      setError(err instanceof Error ? err.message : "Failed to continue in panel");
    } finally {
      setLoading(false);
    }
  }, [
    edges,
    graphId,
    nodes,
    nodesById,
    panelAnchorNodeId,
    panelText,
    refreshGraphList,
    setEdges,
    setError,
    setLoading,
    setNodes,
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
