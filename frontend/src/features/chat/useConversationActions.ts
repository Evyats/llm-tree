import { useCallback, useEffect, useRef } from "react";
import type { Node } from "reactflow";

import { continueFromNode, continueInPanel } from "../../api/client";
import { toErrorMessage } from "../../api/errors";
import { getContinueFromVariantIndex } from "../graph/nodeSelectors";
import type { NodeData } from "../../store/useGraphStore";
import type { Edge } from "reactflow";
import {
  buildOptimisticBranch,
  isOptimisticBranchStillRelevant,
  removeOptimisticBranch,
  reconcileOptimisticBranch,
} from "./optimisticBranch";
import {
  appendUserLine,
  buildOptimisticStartPosition,
  createFallbackDelayWaiter,
  createPersistedAnchorResolver,
  createTempId,
  isPendingAssistantAnchor,
  pruneAssistantVariantsInNodes,
  restoreDraftIfStillEmpty,
} from "./conversationActionUtils";
import { buildTranscriptUntilNode } from "./transcript";

interface UseConversationActionsParams {
  graphId: string | null;
  selectedNodeId: string | null;
  panelAnchorNodeId: string | null;
  composerText: string;
  panelText: string;
  selectedModel: string;
  fallbackDelayMs: number;
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
  startLlmTask: (label: string) => string;
  finishLlmTask: (taskId: string | null) => void;
  maybeAutoNameGraph: (nextNodes: Node<NodeData>[]) => Promise<void>;
  centerNodeInView: (nodeId: string, duration?: number) => void;
}

export function useConversationActions({
  graphId,
  selectedNodeId,
  panelAnchorNodeId,
  composerText,
  panelText,
  selectedModel,
  fallbackDelayMs,
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
  startLlmTask,
  finishLlmTask,
  maybeAutoNameGraph,
  centerNodeInView,
}: UseConversationActionsParams) {
  const requestCountRef = useRef(0);
  const modelRequestCountRef = useRef(0);
  const composerTextRef = useRef(composerText);
  const panelTextRef = useRef(panelText);

  useEffect(() => {
    composerTextRef.current = composerText;
  }, [composerText]);

  useEffect(() => {
    panelTextRef.current = panelText;
  }, [panelText]);

  const beginRequest = useCallback(() => {
    requestCountRef.current += 1;
    setLoading(true);
  }, [setLoading]);

  const endRequest = useCallback(() => {
    requestCountRef.current = Math.max(0, requestCountRef.current - 1);
    setLoading(requestCountRef.current > 0);
  }, [setLoading]);

  const beginModelRequest = useCallback(() => {
    modelRequestCountRef.current += 1;
    setModelResponseLoading(true);
  }, [setModelResponseLoading]);

  const endModelRequest = useCallback(() => {
    modelRequestCountRef.current = Math.max(0, modelRequestCountRef.current - 1);
    setModelResponseLoading(modelRequestCountRef.current > 0);
  }, [setModelResponseLoading]);

  const resolvePersistedAnchorId = useCallback(createPersistedAnchorResolver(nodesById), [nodesById]);
  const waitForFallbackDelay = useCallback(createFallbackDelayWaiter(selectedModel, fallbackDelayMs), [fallbackDelayMs, selectedModel]);

  const sendContinue = useCallback(
    async (mode: "normal" | "elaboration", highlightedText?: string) => {
      if (!graphId) return;
      if (isPendingAssistantAnchor(nodesById, selectedNodeId)) {
        setError("Please wait for the assistant response to finish before continuing from this node.");
        return;
      }
      const elaborationBase = highlightedText?.trim() ?? "";
      const elaborationText = elaborationBase
        ? `${elaborationBase}${elaborationBase.endsWith("?") ? "" : "?"}`
        : "";
      const userText = mode === "elaboration" ? elaborationText : composerText.trim();
      if (!userText) return;
      const previousComposerText = composerText;
      const baseNodes = getLatestNodes();
      const baseEdges = getLatestEdges();
      const baseNodesById = new Map(baseNodes.map((node) => [node.id, node]));
      const continueFromNodeId = resolvePersistedAnchorId(selectedNodeId);
      const { baseX, baseY } = buildOptimisticStartPosition(baseNodesById, continueFromNodeId);
      const optimistic = buildOptimisticBranch(
        baseNodes,
        baseEdges,
        continueFromNodeId,
        userText,
        baseX,
        baseY,
        createTempId,
        mode
      );
      optimistic.nodes[optimistic.nodes.length - 2].data.highlightedText = highlightedText ?? null;
      const isRequestStillRelevant = () =>
        isOptimisticBranchStillRelevant(getLatestNodes(), {
          tempUserId: optimistic.ids.tempUserId,
          tempAssistantId: optimistic.ids.tempAssistantId,
        });
      let llmTaskId: string | null = null;
      try {
        beginRequest();
        beginModelRequest();
        llmTaskId = startLlmTask(mode === "elaboration" ? "Generating elaboration" : "Generating reply");
        setError(null);
        composerTextRef.current = "";
        setComposerText("");
        setNodes(optimistic.nodes);
        setEdges(optimistic.edges);
        setSelectedNode(optimistic.ids.tempAssistantId);
        const response = await continueFromNode({
          graph_id: graphId,
          continue_from_node_id: continueFromNodeId,
          continue_from_variant_index: getContinueFromVariantIndex(baseNodesById, continueFromNodeId),
          user_text: userText,
          mode,
          highlighted_text: highlightedText ?? null,
          selected_model: selectedModel,
        });
        await waitForFallbackDelay();
        const next = reconcileOptimisticBranch(getLatestNodes(), getLatestEdges(), response, optimistic.ids);
        if (!isRequestStillRelevant()) {
          return;
        }
        setNodes(pruneAssistantVariantsInNodes(next.nodes, continueFromNodeId));
        setEdges(next.edges);
        setSelectedNode(response.created_assistant_node.id);
        if (mode !== "elaboration") {
          const targetNodeId = continueFromNodeId ?? response.created_user_node.id;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              centerNodeInView(targetNodeId);
            });
          });
        }
        setResponseSource(response.response_source);
        setTranscript(response.transcript_window);
        clearElaborateAction();
        await maybeAutoNameGraph(next.nodes);
        await refreshGraphList();
      } catch (err) {
        if (isRequestStillRelevant()) {
          const next = removeOptimisticBranch(getLatestNodes(), getLatestEdges(), optimistic.ids);
          setNodes(next.nodes);
          setEdges(next.edges);
          restoreDraftIfStillEmpty(composerTextRef, previousComposerText, setComposerText);
          setError(toErrorMessage(err, "Failed to continue conversation"));
        }
      } finally {
        finishLlmTask(llmTaskId);
        endModelRequest();
        endRequest();
      }
    },
    [
      beginModelRequest,
      beginRequest,
      endModelRequest,
      endRequest,
      composerText,
      getLatestEdges,
      getLatestNodes,
      graphId,
      nodesById,
      refreshGraphList,
      resolvePersistedAnchorId,
      selectedNodeId,
      selectedModel,
      fallbackDelayMs,
      setComposerText,
      setEdges,
      clearElaborateAction,
      setError,
        finishLlmTask,
        setNodes,
        setResponseSource,
        setSelectedNode,
        startLlmTask,
        setTranscript,
      maybeAutoNameGraph,
      centerNodeInView,
      waitForFallbackDelay,
    ]
  );

  const sendPanelContinue = useCallback(async () => {
    if (!graphId || !panelAnchorNodeId) return;
    if (isPendingAssistantAnchor(nodesById, panelAnchorNodeId)) {
      setError("Please wait for the assistant response to finish before continuing from this node.");
      return;
    }
    if (!panelText.trim()) return;
    const previousPanelText = panelText;
    const baseNodes = getLatestNodes();
    const baseEdges = getLatestEdges();
    const baseNodesById = new Map(baseNodes.map((node) => [node.id, node]));
    const persistedAnchorNodeId = resolvePersistedAnchorId(panelAnchorNodeId);
    if (!persistedAnchorNodeId) {
      setError("Please wait for the pending response to finish, then try again.");
      return;
    }
    const { baseX, baseY } = buildOptimisticStartPosition(baseNodesById, persistedAnchorNodeId);
    const userText = panelText.trim();
    const previousTranscript = buildTranscriptUntilNode(baseNodes, persistedAnchorNodeId);
    const optimistic = buildOptimisticBranch(
      baseNodes,
      baseEdges,
      persistedAnchorNodeId,
      userText,
      baseX,
      baseY,
      createTempId,
      "normal"
    );
    const isRequestStillRelevant = () =>
      isOptimisticBranchStillRelevant(getLatestNodes(), {
        tempUserId: optimistic.ids.tempUserId,
        tempAssistantId: optimistic.ids.tempAssistantId,
      });
    let llmTaskId: string | null = null;
    try {
      beginRequest();
      beginModelRequest();
      llmTaskId = startLlmTask("Generating context reply");
      setError(null);
      panelTextRef.current = "";
      setPanelText("");
      setNodes(optimistic.nodes);
      setEdges(optimistic.edges);
      setSelectedNode(optimistic.ids.tempAssistantId);
      setTranscript(appendUserLine(previousTranscript, userText));
      const response = await continueInPanel({
        graph_id: graphId,
        anchor_node_id: persistedAnchorNodeId,
        anchor_variant_index: getContinueFromVariantIndex(baseNodesById, persistedAnchorNodeId),
        user_text: userText,
        selected_model: selectedModel,
      });
      await waitForFallbackDelay();
      const next = reconcileOptimisticBranch(getLatestNodes(), getLatestEdges(), response, optimistic.ids);
      if (!isRequestStillRelevant()) {
        return;
      }
      setNodes(pruneAssistantVariantsInNodes(next.nodes, persistedAnchorNodeId));
      setEdges(next.edges);
      setPanelAnchorNodeId(response.created_assistant_node.id);
      setSelectedNode(response.created_assistant_node.id);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          centerNodeInView(persistedAnchorNodeId);
        });
      });
      setTranscript(response.transcript_window);
      setResponseSource(response.response_source);
      await maybeAutoNameGraph(next.nodes);
      await refreshGraphList();
    } catch (err) {
      if (isRequestStillRelevant()) {
        const next = removeOptimisticBranch(getLatestNodes(), getLatestEdges(), optimistic.ids);
        setNodes(next.nodes);
        setEdges(next.edges);
        restoreDraftIfStillEmpty(panelTextRef, previousPanelText, setPanelText);
        setTranscript(previousTranscript);
        setError(toErrorMessage(err, "Failed to continue in panel"));
      }
    } finally {
      finishLlmTask(llmTaskId);
      endModelRequest();
      endRequest();
    }
  }, [
    beginModelRequest,
    beginRequest,
    endModelRequest,
    endRequest,
    getLatestEdges,
    getLatestNodes,
    graphId,
    nodesById,
    panelAnchorNodeId,
    panelText,
    selectedModel,
    fallbackDelayMs,
    refreshGraphList,
    resolvePersistedAnchorId,
    setEdges,
    setError,
    finishLlmTask,
    setNodes,
    setPanelAnchorNodeId,
    setPanelText,
    setResponseSource,
    setSelectedNode,
    startLlmTask,
    setTranscript,
    maybeAutoNameGraph,
    centerNodeInView,
    waitForFallbackDelay,
    pruneAssistantVariantsInNodes,
  ]);

  return {
    sendContinue,
    sendPanelContinue,
  };
}
