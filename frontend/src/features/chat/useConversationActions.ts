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
  selectedModel: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  getLatestNodes: () => Node<NodeData>[];
  getLatestEdges: () => Edge[];
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
  setModelResponseLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
  clearElaborateAction: () => void;
}

export function useConversationActions({
  graphId,
  selectedNodeId,
  panelAnchorNodeId,
  composerText,
  panelText,
  selectedModel,
  nodes,
  edges,
  getLatestNodes,
  getLatestEdges,
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
  setModelResponseLoading,
  setError,
  clearElaborateAction,
}: UseConversationActionsParams) {
  const isTempId = (id: string | null | undefined): id is string => Boolean(id && id.startsWith("temp-"));

  const resolvePersistedAnchorId = useCallback(
    (startId: string | null): string | null => {
      let cursor = startId;
      const seen = new Set<string>();
      while (cursor) {
        if (seen.has(cursor)) return null;
        seen.add(cursor);
        if (!isTempId(cursor)) return cursor;
        cursor = nodesById.get(cursor)?.data.parentId ?? null;
      }
      return null;
    },
    [nodesById]
  );

  const generateTempId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `temp-${crypto.randomUUID()}`
      : `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const isPendingAssistantAnchor = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) return false;
      const node = nodesById.get(nodeId);
      return node?.data.role === "assistant" && node.data.pending === true;
    },
    [nodesById]
  );

  const sendContinue = useCallback(
    async (mode: "normal" | "elaboration", highlightedText?: string) => {
      if (!graphId) return;
      if (isPendingAssistantAnchor(selectedNodeId)) {
        setError("Please wait for the assistant response to finish before continuing from this node.");
        return;
      }
      const elaborationBase = highlightedText?.trim() ?? "";
      const elaborationText = elaborationBase
        ? `${elaborationBase}${elaborationBase.endsWith("?") ? "" : "?"}`
        : "";
      const userText = mode === "elaboration" ? elaborationText : composerText.trim();
      if (!userText) return;
      const baseNodes = getLatestNodes();
      const baseEdges = getLatestEdges();
      const baseNodesById = new Map(baseNodes.map((node) => [node.id, node]));
      const continueFromNodeId = resolvePersistedAnchorId(selectedNodeId);
      const parentPos = continueFromNodeId ? baseNodesById.get(continueFromNodeId)?.position : null;
      const baseX = parentPos?.x ?? 0;
      const baseY = (parentPos?.y ?? 80) + 170;
      const tempUserId = generateTempId();
      const tempAssistantId = generateTempId();
      const tempUserEdgeId = generateTempId();
      const tempAssistantEdgeId = generateTempId();
      const optimisticNodes: Node<NodeData>[] = [
        ...baseNodes,
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
        ...baseEdges,
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
      const isRequestStillRelevant = () => {
        const currentNodes = getLatestNodes();
        const currentIds = new Set(currentNodes.map((node) => node.id));
        return currentIds.has(tempUserId) && currentIds.has(tempAssistantId);
      };
      try {
        setLoading(true);
        setModelResponseLoading(true);
        setError(null);
        setNodes(optimisticNodes);
        setEdges(optimisticEdges);
        setSelectedNode(tempAssistantId);
        const response = await continueFromNode({
          graph_id: graphId,
          continue_from_node_id: continueFromNodeId,
          continue_from_variant_index: getContinueFromVariantIndex(baseNodesById, continueFromNodeId),
          user_text: userText,
          mode,
          highlighted_text: highlightedText ?? null,
          selected_model: selectedModel,
        });
        const nextNodes = optimisticNodes
          .filter((node) => node.id !== tempUserId && node.id !== tempAssistantId)
          .concat([nodePayloadToFlowNode(response.created_user_node), nodePayloadToFlowNode(response.created_assistant_node)]);
        const nextEdges = optimisticEdges
          .filter((edge) => edge.id !== tempUserEdgeId && edge.id !== tempAssistantEdgeId)
          .concat(response.created_edges.map(edgePayloadToFlowEdge));
        if (!isRequestStillRelevant()) {
          return;
        }
        setNodes(nextNodes);
        setEdges(nextEdges);
        setSelectedNode(response.created_assistant_node.id);
        setResponseSource(response.response_source);
        setTranscript(response.transcript_window);
        setComposerText("");
        clearElaborateAction();
        await refreshGraphList();
      } catch (err) {
        if (isRequestStillRelevant()) {
          setNodes(baseNodes);
          setEdges(baseEdges);
          setError(err instanceof Error ? err.message : "Failed to continue conversation");
        }
      } finally {
        setModelResponseLoading(false);
        setLoading(false);
      }
    },
    [
      composerText,
      edges,
      getLatestEdges,
      getLatestNodes,
      graphId,
      isPendingAssistantAnchor,
      nodes,
      nodesById,
      refreshGraphList,
      resolvePersistedAnchorId,
      selectedNodeId,
      selectedModel,
      setComposerText,
      setEdges,
      clearElaborateAction,
    setError,
    setLoading,
    setModelResponseLoading,
    setNodes,
    setResponseSource,
    setSelectedNode,
      setTranscript,
    ]
  );

  const sendPanelContinue = useCallback(async () => {
    if (!graphId || !panelAnchorNodeId) return;
    if (isPendingAssistantAnchor(panelAnchorNodeId)) {
      setError("Please wait for the assistant response to finish before continuing from this node.");
      return;
    }
    if (!panelText.trim()) return;
    const baseNodes = getLatestNodes();
    const baseEdges = getLatestEdges();
    const baseNodesById = new Map(baseNodes.map((node) => [node.id, node]));
    const persistedAnchorNodeId = resolvePersistedAnchorId(panelAnchorNodeId);
    if (!persistedAnchorNodeId) {
      setError("Please wait for the pending response to finish, then try again.");
      return;
    }
    const anchorPos = baseNodesById.get(persistedAnchorNodeId)?.position;
    const baseX = anchorPos?.x ?? 0;
    const baseY = (anchorPos?.y ?? 80) + 170;
    const userText = panelText.trim();
    const tempUserId = generateTempId();
    const tempAssistantId = generateTempId();
    const tempUserEdgeId = generateTempId();
    const tempAssistantEdgeId = generateTempId();
    const optimisticNodes: Node<NodeData>[] = [
      ...baseNodes,
      {
        id: tempUserId,
        type: "userNode",
        position: { x: baseX, y: baseY },
        data: {
          role: "user",
          parentId: persistedAnchorNodeId,
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
      ...baseEdges,
      {
        id: tempUserEdgeId,
        source: persistedAnchorNodeId,
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
    const isRequestStillRelevant = () => {
      const currentNodes = getLatestNodes();
      const currentIds = new Set(currentNodes.map((node) => node.id));
      return currentIds.has(tempUserId) && currentIds.has(tempAssistantId);
    };
    try {
      setLoading(true);
      setModelResponseLoading(true);
      setError(null);
      setNodes(optimisticNodes);
      setEdges(optimisticEdges);
      setSelectedNode(tempAssistantId);
      const response = await continueInPanel({
        graph_id: graphId,
        anchor_node_id: persistedAnchorNodeId,
        anchor_variant_index: getContinueFromVariantIndex(baseNodesById, persistedAnchorNodeId),
        user_text: userText,
        selected_model: selectedModel,
      });
      const nextNodes = optimisticNodes
        .filter((node) => node.id !== tempUserId && node.id !== tempAssistantId)
        .concat([nodePayloadToFlowNode(response.created_user_node), nodePayloadToFlowNode(response.created_assistant_node)]);
      const nextEdges = optimisticEdges
        .filter((edge) => edge.id !== tempUserEdgeId && edge.id !== tempAssistantEdgeId)
        .concat(response.created_edges.map(edgePayloadToFlowEdge));
      if (!isRequestStillRelevant()) {
        return;
      }
      setNodes(nextNodes);
      setEdges(nextEdges);
      setPanelAnchorNodeId(response.created_assistant_node.id);
      setSelectedNode(response.created_assistant_node.id);
      setTranscript(response.transcript_window);
      setResponseSource(response.response_source);
      setPanelText("");
      await refreshGraphList();
    } catch (err) {
      if (isRequestStillRelevant()) {
        setNodes(baseNodes);
        setEdges(baseEdges);
        setError(err instanceof Error ? err.message : "Failed to continue in panel");
      }
    } finally {
      setModelResponseLoading(false);
      setLoading(false);
    }
  }, [
    edges,
    getLatestEdges,
    getLatestNodes,
    graphId,
    isPendingAssistantAnchor,
    nodes,
    nodesById,
    panelAnchorNodeId,
    panelText,
    selectedModel,
    refreshGraphList,
    resolvePersistedAnchorId,
    setEdges,
    setError,
    setLoading,
    setModelResponseLoading,
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
