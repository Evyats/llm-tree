import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  ControlButton,
  Controls,
  MiniMap,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import {
  compactBranch,
  deleteNodeSubtree,
  extractNodePath,
  getGraph,
  listAvailableModels,
  setSessionApiKey,
  updateVariant,
} from "./api/client";
import ElaborateButton from "./components/common/ElaborateButton";
import ModelResponseBanner from "./components/overlays/ModelResponseBanner";
import WheelModeBanner from "./components/overlays/WheelModeBanner";
import ContextPanel from "./components/panels/ContextPanel";
import LayoutControlsPanel from "./components/panels/LayoutControlsPanel";
import ComposerBar from "./components/panels/ComposerBar";
import PreviousChatsSidebar from "./components/panels/PreviousChatsSidebar";
import AppHeader from "./components/panels/AppHeader";
import AssistantNode from "./components/AssistantNode";
import CollapsedNode from "./components/CollapsedNode";
import UserNode from "./components/UserNode";
import { buildTranscriptUntilNode } from "./features/chat/transcript";
import { buildTranscriptFromPayloadNodes } from "./features/chat/payloadTranscript";
import { useGraphBootstrap } from "./features/chat/useGraphBootstrap";
import { useConversationActions } from "./features/chat/useConversationActions";
import { useGraphSessions } from "./features/chat/useGraphSessions";
import {
  buildChildrenBySource,
  buildCollapsedProxyTargets,
  buildHiddenNodeIds,
  buildLayoutNodeSizes,
  buildLayoutNodes,
  buildProjectedUiEdges,
  collectSubtreeNodeIds,
  pruneCollapsedEdgeSources,
  pruneCollapsedTargets,
} from "./features/graph/collapseProjection";
import {
  ASSISTANT_WHEEL_STEP_COOLDOWN_MS,
  COLLAPSED_NODE_SIZE,
  DEFAULT_ASSISTANT_WHEEL_HOLD_MS,
} from "./features/graph/constants";
import { buildDeleteProjection } from "./features/graph/deleteProjection";
import { type EdgeLineStyleValue, type EdgeMotionValue, type EdgeTypeValue } from "./features/graph/edgeStyles";
import { applyFoldForEdgeWithController, applyFoldForNodeWithController } from "./features/graph/foldController";
import { buildNodeMap, getAssistantNodesWithUserBranch } from "./features/graph/nodeSelectors";
import type { GraphNodeUiData } from "./features/graph/nodeUi";
import {
  COLLAPSED_PREVIEW_TEXT_MAX,
  DEFAULT_FIT_VIEW_BUTTON_PADDING,
  MAX_ZOOM,
  MIN_ZOOM,
  NODE_MAX_WIDTH_DEFAULT,
  NODE_MAX_WIDTH_UNIT_PX,
  NODE_MIN_WIDTH_DEFAULT,
  NODE_ORIGIN_X,
  NODE_ORIGIN_Y,
  FIT_VIEW_OPTIONS,
  FIXED_MIN_COL_GAP,
  FIXED_ROW_GAP,
  FIXED_TREE_GAP,
  ZOOM_BUTTON_FACTOR,
} from "./features/layout/constants";
import { buildFixedPositions } from "./features/layout/layoutEngine";
import { DEFAULT_ROLE_SIZING, setNodeSizingRuntime } from "./features/layout/nodeSizing";
import { useViewportControls } from "./features/layout/useViewportControls";
import { useCollapsedBranches } from "./features/graph/useCollapsedBranches";
import type { LayoutSliderTab } from "./features/layout/types";
import { useGraphStore, type NodeData } from "./store/useGraphStore";

interface ElaborateAction {
  nodeId: string;
  text: string;
  occurrence: number;
  x: number;
  y: number;
}

export default function App() {
  const {
    graphId,
    title,
    nodes,
    edges,
    selectedNodeId,
    panelOpen,
    transcript,
    responseSource,
    setGraph,
    appendEntities,
    setSelectedNode,
    setNodes,
    setEdges,
    updateNodeVariant: updateVariantLocal,
    lockNodeVariant,
    addElaboratedSelection,
    setPanelOpen,
    setTranscript,
    setResponseSource,
  } = useGraphStore();

  const [composerText, setComposerText] = useState("");
  const [panelText, setPanelText] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelResponseLoading, setModelResponseLoading] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("fallback");
  const [elaborateAction, setElaborateAction] = useState<ElaborateAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [fixedMode, setFixedMode] = useState(true);
  const [nodeSizes, setNodeSizes] = useState<Map<string, { width: number; height: number }>>(new Map());
  const [fitViewPadding, setFitViewPadding] = useState(DEFAULT_FIT_VIEW_BUTTON_PADDING);
  const [rowGap, setRowGap] = useState(FIXED_ROW_GAP);
  const [treeGap, setTreeGap] = useState(FIXED_TREE_GAP);
  const [siblingGap, setSiblingGap] = useState(FIXED_MIN_COL_GAP);
  const [nodeMinWidth, setNodeMinWidth] = useState(NODE_MIN_WIDTH_DEFAULT);
  const [nodeMaxWidth, setNodeMaxWidth] = useState(NODE_MAX_WIDTH_DEFAULT);
  const [nodeStepChars, setNodeStepChars] = useState(DEFAULT_ROLE_SIZING.assistant.widthStepChars);
  const [nodeStepPx, setNodeStepPx] = useState(DEFAULT_ROLE_SIZING.assistant.widthStepPx);
  const [assistantWheelHoldMs, setAssistantWheelHoldMs] = useState(DEFAULT_ASSISTANT_WHEEL_HOLD_MS);
  const [fallbackDelayMs, setFallbackDelayMs] = useState(0);
  const [userEdgeType, setUserEdgeType] = useState<EdgeTypeValue>("default");
  const [assistantEdgeType, setAssistantEdgeType] = useState<EdgeTypeValue>("default");
  const [userEdgeMotion, setUserEdgeMotion] = useState<EdgeMotionValue>("animated");
  const [assistantEdgeMotion, setAssistantEdgeMotion] = useState<EdgeMotionValue>("static");
  const [userEdgeLineStyle, setUserEdgeLineStyle] = useState<EdgeLineStyleValue>("dashed");
  const [assistantEdgeLineStyle, setAssistantEdgeLineStyle] = useState<EdgeLineStyleValue>("solid");
  const [layoutPanelOpen, setLayoutPanelOpen] = useState(false);
  const [layoutSliderTab, setLayoutSliderTab] = useState<LayoutSliderTab>("spacing");
  const [layoutPanelPosition, setLayoutPanelPosition] = useState({ left: 120, top: 56 });
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [panelAnchorNodeId, setPanelAnchorNodeId] = useState<string | null>(null);
  const [showFullSelectedNodeId, setShowFullSelectedNodeId] = useState(false);
  const [wheelHoverNodeId, setWheelHoverNodeId] = useState<string | null>(null);
  const [wheelHoverProgress, setWheelHoverProgress] = useState(0);
  const [wheelHoverActive, setWheelHoverActive] = useState(false);
  const [nodeContextMenuNodeId, setNodeContextMenuNodeId] = useState<string | null>(null);
  const [compactingNodeIds, setCompactingNodeIds] = useState<Set<string>>(new Set());
  const {
    collapsedTargets,
    collapsedEdgeSources,
    setCollapsedTargets,
    setCollapsedEdgeSources,
    resetCollapsed,
    collapseByEdge,
    unfoldSubtree,
  } = useCollapsedBranches();
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const nodeSizingSignature = `${nodeMinWidth}-${nodeMaxWidth}-${nodeStepChars}-${nodeStepPx}`;

  const manualPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const wheelHoverStartRef = useRef<number>(0);
  const wheelHoverRafRef = useRef<number | null>(null);
  const wheelLastStepAtRef = useRef(0);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const suppressPaneClearUntilRef = useRef(0);
  const compactingCountsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (event.key.length !== 1) {
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      composerInputRef.current?.focus();
      setComposerText((prev) => prev + event.key);
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
    };
    const onWheel = (event: WheelEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  useEffect(() => {
    manualPositionsRef.current = new Map();
    setNodeSizes(new Map());
    resetCollapsed();
    setCompactingNodeIds(new Set());
    compactingCountsRef.current = new Map();
  }, [graphId, resetCollapsed]);

  const addCompactingNodeIds = useCallback((ids: Set<string>) => {
    const nextCounts = new Map(compactingCountsRef.current);
    for (const id of ids) {
      nextCounts.set(id, (nextCounts.get(id) ?? 0) + 1);
    }
    compactingCountsRef.current = nextCounts;
    setCompactingNodeIds(new Set(nextCounts.keys()));
  }, []);

  const removeCompactingNodeIds = useCallback((ids: Set<string>) => {
    const nextCounts = new Map(compactingCountsRef.current);
    for (const id of ids) {
      const current = nextCounts.get(id) ?? 0;
      if (current <= 1) {
        nextCounts.delete(id);
      } else {
        nextCounts.set(id, current - 1);
      }
    }
    compactingCountsRef.current = nextCounts;
    setCompactingNodeIds(new Set(nextCounts.keys()));
  }, []);

  useEffect(() => {
    const maxWidthPx = nodeMaxWidth * NODE_MAX_WIDTH_UNIT_PX;
    setNodeSizingRuntime({
      assistant: {
        minWidth: nodeMinWidth,
        maxWidth: maxWidthPx,
        widthStepChars: nodeStepChars,
        widthStepPx: nodeStepPx,
      },
      user: {
        minWidth: nodeMinWidth,
        maxWidth: maxWidthPx,
        widthStepChars: nodeStepChars,
        widthStepPx: nodeStepPx,
      },
    });
  }, [
    nodeMaxWidth,
    nodeMinWidth,
    nodeStepChars,
    nodeStepPx,
  ]);

  useEffect(() => {
    const maxWidthPx = nodeMaxWidth * NODE_MAX_WIDTH_UNIT_PX;
    if (nodeMinWidth > maxWidthPx) {
      setNodeMaxWidth(Math.ceil(nodeMinWidth / NODE_MAX_WIDTH_UNIT_PX));
    }
  }, [nodeMaxWidth, nodeMinWidth]);

  useEffect(() => {
    for (const node of nodes) {
      if (!manualPositionsRef.current.has(node.id)) {
        manualPositionsRef.current.set(node.id, { ...node.position });
      }
    }
  }, [nodes]);

  const { fitCanvasToGraph, zoomIn, zoomOut } = useViewportControls({
    reactFlowInstance,
    mainElement: mainRef.current,
    fitViewPadding,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    nodeOriginX: NODE_ORIGIN_X,
    nodeOriginY: NODE_ORIGIN_Y,
  });

  const updateLayoutPanelPosition = useCallback(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;
    const controlsEl = mainEl.querySelector(".react-flow__controls") as HTMLElement | null;
    if (!controlsEl) return;
    const mainRect = mainEl.getBoundingClientRect();
    const controlsRect = controlsEl.getBoundingClientRect();
    setLayoutPanelPosition({
      left: controlsRect.right - mainRect.left + 8,
      top: controlsRect.top - mainRect.top,
    });
  }, []);

  const refreshMeasuredNodeSizes = useCallback(() => {
    if (!reactFlowInstance) return;
    const measured = reactFlowInstance.getNodes();
    const next = new Map<string, { width: number; height: number }>();
    for (const node of measured) {
      if (typeof node.width === "number" && node.width > 0 && typeof node.height === "number" && node.height > 0) {
        next.set(node.id, { width: node.width, height: node.height });
      }
    }
    setNodeSizes(next);
  }, [reactFlowInstance]);

  const {
    previousChats,
    refreshGraphList,
    loadGraph,
    startNewChat,
    selectChatFromHistory,
    handleRenameChat,
    handleDeleteChat,
    handleDeleteAllChats,
  } = useGraphSessions({
    graphId,
    nodesCount: nodes.length,
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
  });

  useGraphBootstrap({
    setLoading,
    setError,
    setGraph,
    fitCanvasToGraph,
    refreshGraphList,
  });

  useEffect(() => {
    let cancelled = false;
    const loadModels = async () => {
      try {
        const response = await listAvailableModels();
        if (!cancelled) {
          setAvailableModels(response.models ?? []);
        }
      } catch {
        if (!cancelled) {
          setAvailableModels([]);
        }
      }
    };
    void loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, nodes);
      setNodes(next);
      if (!fixedMode) {
        for (const node of next) {
          manualPositionsRef.current.set(node.id, { ...node.position });
        }
      }
    },
    [fixedMode, nodes, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(applyEdgeChanges(changes, edges));
    },
    [edges, setEdges]
  );

  const nodesById = useMemo(() => buildNodeMap(nodes), [nodes]);
  const childrenByNodeId = useMemo(() => buildChildrenBySource(edges), [edges]);

  const getSubtreeNodeIds = useCallback(
    (startNodeId: string) => collectSubtreeNodeIds(startNodeId, childrenByNodeId),
    [childrenByNodeId]
  );

  useEffect(() => {
    setCollapsedTargets((prev) => {
      const next = pruneCollapsedTargets(nodes, prev);
      if (next.size !== prev.size) {
        return next;
      }
      for (const id of prev) {
        if (!next.has(id)) {
          return next;
        }
      }
      return prev;
    });
  }, [nodes, setCollapsedTargets]);

  useEffect(() => {
    setCollapsedEdgeSources((prev) => {
      const next = pruneCollapsedEdgeSources(nodes, collapsedTargets, prev);
      if (next.size !== prev.size) {
        return next;
      }
      for (const [targetId, sourceId] of prev) {
        if (next.get(targetId) !== sourceId) {
          return next;
        }
      }
      return prev;
    });
  }, [collapsedTargets, nodes]);

  const cycleVariant = useCallback(
    async (nodeId: string, direction: -1 | 1) => {
      const node = nodesById.get(nodeId);
      if (node?.data.variantLocked) {
        return;
      }
      const current = node?.data.variantIndex ?? 0;
      const next = (current + direction + 3) % 3;
      updateVariantLocal(nodeId, next);
      try {
        await updateVariant(nodeId, next);
      } catch {
        // Keep UI optimistic even if persistence update fails.
      }
    },
    [nodesById, updateVariantLocal]
  );

  const clearAssistantWheelHover = useCallback(() => {
    if (wheelHoverRafRef.current !== null) {
      cancelAnimationFrame(wheelHoverRafRef.current);
      wheelHoverRafRef.current = null;
    }
    setWheelHoverNodeId(null);
    setWheelHoverProgress(0);
    setWheelHoverActive(false);
    wheelHoverStartRef.current = 0;
    wheelLastStepAtRef.current = 0;
  }, []);

  const approveVariant = useCallback(
    (nodeId: string) => {
      lockNodeVariant(nodeId);
      if (wheelHoverNodeId === nodeId) {
        clearAssistantWheelHover();
      }
    },
    [clearAssistantWheelHover, lockNodeVariant, wheelHoverNodeId]
  );

  const handleAssistantHoverStart = useCallback(
    (nodeId: string) => {
      setWheelHoverNodeId(nodeId);
      if (assistantWheelHoldMs <= 0) {
        setWheelHoverProgress(1);
        setWheelHoverActive(true);
        wheelLastStepAtRef.current = 0;
        return;
      }
      setWheelHoverProgress(0);
      setWheelHoverActive(false);
      wheelHoverStartRef.current = performance.now();
      wheelLastStepAtRef.current = 0;
      const tick = () => {
        const elapsed = performance.now() - wheelHoverStartRef.current;
        const progress = Math.max(0, Math.min(1, elapsed / assistantWheelHoldMs));
        setWheelHoverProgress(progress);
        if (progress >= 1) {
          setWheelHoverActive(true);
          wheelHoverRafRef.current = null;
          return;
        }
        wheelHoverRafRef.current = requestAnimationFrame(tick);
      };
      wheelHoverRafRef.current = requestAnimationFrame(tick);
    },
    [assistantWheelHoldMs]
  );

  const handleAssistantHoverEnd = useCallback(
    (nodeId: string) => {
      if (wheelHoverNodeId !== nodeId) {
        return;
      }
      clearAssistantWheelHover();
    },
    [clearAssistantWheelHover, wheelHoverNodeId]
  );

  const handleAssistantWheel = useCallback(
    (nodeId: string, deltaY: number, clientX: number, clientY: number) => {
      lastPointerRef.current = { x: clientX, y: clientY };
      if (!wheelHoverActive || wheelHoverNodeId !== nodeId) {
        return false;
      }
      const now = performance.now();
      if (now - wheelLastStepAtRef.current < ASSISTANT_WHEEL_STEP_COOLDOWN_MS) {
        return true;
      }
      wheelLastStepAtRef.current = now;
      const direction: -1 | 1 = deltaY > 0 ? 1 : -1;
      void cycleVariant(nodeId, direction);
      return true;
    },
    [cycleVariant, wheelHoverActive, wheelHoverNodeId]
  );

  useEffect(() => () => clearAssistantWheelHover(), [clearAssistantWheelHover]);

  useEffect(() => {
    if (!nodeContextMenuNodeId) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest('[data-node-action-button="true"]')) {
        return;
      }
      setNodeContextMenuNodeId(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [nodeContextMenuNodeId]);

  const { sendContinue, sendPanelContinue } = useConversationActions({
    graphId,
    selectedNodeId,
    panelAnchorNodeId,
    composerText,
    panelText,
    selectedModel,
    fallbackDelayMs,
    nodes,
    edges,
    getLatestNodes: () => nodesRef.current,
    getLatestEdges: () => edgesRef.current,
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
    clearElaborateAction: () => setElaborateAction(null),
  });

  const handleDeleteNodeSubtree = useCallback(
    async (nodeId: string) => {
      if (!graphId) return;
      const idsToDelete = getSubtreeNodeIds(nodeId);
      if (idsToDelete.size === 0) return;
      const snapshot = buildDeleteProjection(nodes, edges, idsToDelete);

      setLoading(true);
      setError(null);
      setNodes(snapshot.nextNodes);
      setEdges(snapshot.nextEdges);
      for (const id of idsToDelete) {
        manualPositionsRef.current.delete(id);
      }
      if (selectedNodeId && idsToDelete.has(selectedNodeId)) {
        setSelectedNode(null);
      }
      if (panelAnchorNodeId && idsToDelete.has(panelAnchorNodeId)) {
        setPanelOpen(false);
        setPanelAnchorNodeId(null);
        setTranscript([]);
      }
      if (elaborateAction && idsToDelete.has(elaborateAction.nodeId)) {
        setElaborateAction(null);
      }
      setNodeContextMenuNodeId(null);

      try {
        await deleteNodeSubtree(nodeId);
        await refreshGraphList();
      } catch (err) {
        setNodes(snapshot.previousNodes);
        setEdges(snapshot.previousEdges);
        setError(err instanceof Error ? err.message : "Failed to delete node branch");
      } finally {
        setLoading(false);
      }
    },
    [
      elaborateAction,
      edges,
      getSubtreeNodeIds,
      graphId,
      nodes,
      panelAnchorNodeId,
      refreshGraphList,
      selectedNodeId,
      setEdges,
      setNodes,
      setPanelOpen,
      setSelectedNode,
      setTranscript,
    ]
  );

  const handleExtractPathToTree = useCallback(
    async (nodeId: string) => {
      if (!graphId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await extractNodePath(nodeId);
        appendEntities(response.created_nodes, response.created_edges);
        setNodeContextMenuNodeId(null);
        await refreshGraphList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to extract node path");
      } finally {
        setLoading(false);
      }
    },
    [appendEntities, graphId, refreshGraphList]
  );

  const handleCompactBranch = useCallback(
    async (nodeId: string) => {
      if (!graphId) return;
      const idsToCompact = getSubtreeNodeIds(nodeId);
      setLoading(true);
      setError(null);
      setNodeContextMenuNodeId(null);
      addCompactingNodeIds(idsToCompact);
      try {
        const response = await compactBranch(nodeId, selectedModel);
        if (selectedModel === "fallback" && fallbackDelayMs > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, fallbackDelayMs));
        }
        setGraph(response.graph_id, response.title, response.nodes, response.edges);
        setSelectedNode(response.compacted_node_id);
        setResponseSource(response.response_source);
        if (panelAnchorNodeId && idsToCompact.has(panelAnchorNodeId)) {
          setPanelOpen(false);
          setPanelAnchorNodeId(null);
          setTranscript([]);
        }
        if (elaborateAction && idsToCompact.has(elaborateAction.nodeId)) {
          setElaborateAction(null);
        }
        await refreshGraphList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to compact branch");
      } finally {
        removeCompactingNodeIds(idsToCompact);
        setLoading(false);
      }
    },
    [
      addCompactingNodeIds,
      elaborateAction,
      getSubtreeNodeIds,
      graphId,
      panelAnchorNodeId,
      refreshGraphList,
      removeCompactingNodeIds,
      fallbackDelayMs,
      selectedModel,
      setGraph,
      setPanelOpen,
      setSelectedNode,
      setTranscript,
      setResponseSource,
    ]
  );

  const openContextPanelForNode = useCallback(
    async (nodeId: string) => {
      suppressPaneClearUntilRef.current = performance.now() + 320;
      setPanelAnchorNodeId(nodeId);
      setSelectedNode(nodeId);
      setPanelOpen(true);
      const localTranscript = buildTranscriptUntilNode(nodes, nodeId);
      if (localTranscript.length > 0) {
        setTranscript(localTranscript);
        return;
      }
      if (!graphId) {
        setTranscript([]);
        return;
      }
      try {
        const graph = await getGraph(graphId);
        setTranscript(buildTranscriptFromPayloadNodes(graph.nodes, nodeId));
      } catch {
        setTranscript([]);
      }
    },
    [graphId, nodes, setPanelOpen, setSelectedNode, setTranscript]
  );

  const nodeTypes = useMemo(
    () => ({
      userNode: UserNode,
      assistantNode: AssistantNode,
      collapsedNode: CollapsedNode,
    }),
    []
  );

  const toggleLayoutMode = useCallback(() => {
    if (fixedMode) {
      const restored = nodesRef.current.map((node) => {
        const manual = manualPositionsRef.current.get(node.id);
        return manual ? { ...node, position: { ...manual } } : node;
      });
      setNodes(restored);
      setFixedMode(false);
      return;
    }
    setFixedMode(true);
  }, [fixedMode, setNodes]);

  useEffect(() => {
    fitCanvasToGraph();
  }, [fitCanvasToGraph, fixedMode]);

  useEffect(() => {
    if (!fixedMode || !reactFlowInstance) return;
    const raf1 = requestAnimationFrame(() => refreshMeasuredNodeSizes());
    const raf2 = requestAnimationFrame(() => {
      requestAnimationFrame(() => refreshMeasuredNodeSizes());
    });
    const timeout = window.setTimeout(() => refreshMeasuredNodeSizes(), 320);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timeout);
    };
  }, [fixedMode, reactFlowInstance, refreshMeasuredNodeSizes, nodes]);

  useEffect(() => {
    if (!fixedMode || !reactFlowInstance) return;
    const raf = requestAnimationFrame(() => {
      refreshMeasuredNodeSizes();
    });
    const timeout = window.setTimeout(() => {
      refreshMeasuredNodeSizes();
    }, 120);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [fixedMode, nodeSizingSignature, reactFlowInstance, refreshMeasuredNodeSizes]);

  useEffect(() => {
    if (!fixedMode || !layoutPanelOpen) {
      return;
    }
    const raf = requestAnimationFrame(() => {
      updateLayoutPanelPosition();
    });
    const onResize = () => updateLayoutPanelPosition();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [fixedMode, layoutPanelOpen, updateLayoutPanelPosition]);

  const assistantWithBranch = useMemo(() => getAssistantNodesWithUserBranch(nodesById, edges), [edges, nodesById]);
  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) : undefined;
  const panelAnchorNode = panelAnchorNodeId ? nodesById.get(panelAnchorNodeId) : undefined;
  const canCyclePanelAnchorVariant =
    !!panelAnchorNode &&
    panelAnchorNode.data.role === "assistant" &&
    !!panelAnchorNode.data.variants &&
    !panelAnchorNode.data.pending &&
    !panelAnchorNode.data.variantLocked &&
    !assistantWithBranch.has(panelAnchorNode.id);
  const panelAnchorVariantIndex =
    panelAnchorNode?.data.role === "assistant" ? panelAnchorNode.data.variantIndex ?? 0 : 0;

  useEffect(() => {
    if (!wheelHoverNodeId) return;
    const hoveredNode = nodesById.get(wheelHoverNodeId);
    const nodeIsEligible =
      hoveredNode?.data.role === "assistant" &&
      !!hoveredNode.data.variants &&
      !hoveredNode.data.variantLocked &&
      !assistantWithBranch.has(wheelHoverNodeId);
    if (!nodeIsEligible) {
      clearAssistantWheelHover();
    }
  }, [assistantWithBranch, clearAssistantWheelHover, nodesById, wheelHoverNodeId]);

  useEffect(() => {
    if (!wheelHoverNodeId) {
      return;
    }
    const pointer = lastPointerRef.current;
    if (!pointer) {
      return;
    }
    const nodeEl = document.querySelector(`.react-flow__node[data-id="${wheelHoverNodeId}"]`) as HTMLElement | null;
    if (!nodeEl) {
      clearAssistantWheelHover();
      return;
    }
    const rect = nodeEl.getBoundingClientRect();
    const inside =
      pointer.x >= rect.left &&
      pointer.x <= rect.right &&
      pointer.y >= rect.top &&
      pointer.y <= rect.bottom;
    if (!inside) {
      clearAssistantWheelHover();
    }
  }, [clearAssistantWheelHover, nodeSizes, nodes, wheelHoverNodeId]);

  useEffect(() => {
    if (!panelOpen || !panelAnchorNodeId) return;
    const synced = buildTranscriptUntilNode(nodesRef.current, panelAnchorNodeId);
    if (synced.length === 0) return;
    setTranscript(synced);
  }, [panelAnchorNodeId, panelOpen, setTranscript, nodes]);

  const hiddenNodeIds = useMemo(() => buildHiddenNodeIds(collapsedTargets, getSubtreeNodeIds), [collapsedTargets, getSubtreeNodeIds]);
  const hasPendingAssistant = useMemo(
    () => nodes.some((node) => node.data.role === "assistant" && node.data.pending === true),
    [nodes]
  );
  const collapsedProxyTargets = useMemo(
    () => buildCollapsedProxyTargets(collapsedTargets, hiddenNodeIds, nodesById),
    [collapsedTargets, hiddenNodeIds, nodesById]
  );
  const layoutNodes = useMemo(
    () => buildLayoutNodes(nodes, hiddenNodeIds, collapsedProxyTargets),
    [collapsedProxyTargets, hiddenNodeIds, nodes]
  );
  const layoutNodeSizes = useMemo(
    () => buildLayoutNodeSizes(nodeSizes, collapsedProxyTargets, COLLAPSED_NODE_SIZE),
    [collapsedProxyTargets, nodeSizes]
  );

  const structure = useMemo(
    () => buildFixedPositions(layoutNodes, layoutNodeSizes, { rowGap, treeGap, siblingGap }),
    [layoutNodeSizes, layoutNodes, rowGap, siblingGap, treeGap]
  );

  const uiNodes: Node<GraphNodeUiData | { label: string; previewText: string; hiddenCount: number; onUnfold: () => void }>[] =
    useMemo(
    () => {
      const truncatePreview = (text: string) =>
        text.length > COLLAPSED_PREVIEW_TEXT_MAX ? `${text.slice(0, COLLAPSED_PREVIEW_TEXT_MAX - 3)}...` : text;
      const collapsedVisibleSet = new Set(collapsedProxyTargets);
      const baseNodes = nodes
        .filter((node) => !hiddenNodeIds.has(node.id))
        .map((node) => {
          const activeSelectionHighlight =
            elaborateAction && elaborateAction.nodeId === node.id
              ? [{ text: elaborateAction.text, occurrence: elaborateAction.occurrence }]
              : [];
          const mergedHighlights = [...(node.data.elaboratedSelections ?? []), ...activeSelectionHighlight];

          return {
            ...node,
            selected: node.id === selectedNodeId,
            type: collapsedVisibleSet.has(node.id) ? "collapsedNode" : node.type,
            position: fixedMode ? structure.positions.get(node.id) ?? node.position : node.position,
            data: {
              ...(collapsedVisibleSet.has(node.id)
                ? {
                    label: "Folded",
                    previewText: truncatePreview((node.data.text ?? "").trim()),
                    hiddenCount: Math.max(0, getSubtreeNodeIds(node.id).size - 1),
                    onUnfold: () => {
                      unfoldSubtree(getSubtreeNodeIds(node.id));
                    },
                  }
                : {}),
              ...node.data,
              compacting: compactingNodeIds.has(node.id),
              elaboratedSelections: mergedHighlights,
              sizingSignature: nodeSizingSignature,
              layer: structure.meta.get(node.id)?.layer ?? 0,
              siblingOrder: structure.meta.get(node.id)?.siblingOrder ?? 0,
              variantLocked: assistantWithBranch.has(node.id) || node.data.variantLocked === true,
              onCycleVariant: cycleVariant,
              onApproveVariant: approveVariant,
          onSelectElaboration: (nodeId: string, text: string, occurrence: number, x: number, y: number) => {
            setElaborateAction({ nodeId, text, occurrence, x, y });
          },
          onOpenPanel: (nodeId: string) => {
            if (panelOpen && panelAnchorNodeId === nodeId) {
              setPanelOpen(false);
                  setPanelAnchorNodeId(null);
                  return;
                }
                void openContextPanelForNode(nodeId);
              },
              panelActive: panelOpen && panelAnchorNodeId === node.id,
              contextMenuOpen: nodeContextMenuNodeId === node.id,
              onDeleteBranch: (nodeId: string) => {
                void handleDeleteNodeSubtree(nodeId);
              },
              onExtractPath: (nodeId: string) => {
                void handleExtractPathToTree(nodeId);
              },
              onCompactBranch: (nodeId: string) => {
                void handleCompactBranch(nodeId);
              },
              onHoverWheelStart: (nodeId: string) => {
                handleAssistantHoverStart(nodeId);
              },
              onHoverWheelEnd: (nodeId: string) => {
                handleAssistantHoverEnd(nodeId);
              },
              onHoverWheelScroll: (nodeId: string, deltaY: number, clientX: number, clientY: number) =>
                handleAssistantWheel(nodeId, deltaY, clientX, clientY),
              onToggleContextMenu: (nodeId: string) => {
                setSelectedNode(nodeId);
                setNodeContextMenuNodeId((prev) => (prev === nodeId ? null : nodeId));
              },
            } as GraphNodeUiData,
          };
        });
      return baseNodes;
    },
    [
      elaborateAction,
      assistantWithBranch,
      approveVariant,
      collapsedProxyTargets,
      cycleVariant,
      fixedMode,
      getSubtreeNodeIds,
      handleAssistantHoverEnd,
      handleAssistantHoverStart,
      handleAssistantWheel,
      compactingNodeIds,
      hiddenNodeIds,
      nodes,
      panelAnchorNodeId,
      panelOpen,
      nodeSizingSignature,
      setPanelOpen,
      setSelectedNode,
      selectedNodeId,
      setTranscript,
      structure,
      unfoldSubtree,
      nodeContextMenuNodeId,
      handleExtractPathToTree,
      handleCompactBranch,
      openContextPanelForNode,
    ]
  );

  const uiEdges: Edge[] = useMemo(() => {
    return buildProjectedUiEdges(
      edges,
      hiddenNodeIds,
      nodesById,
      { type: userEdgeType, motion: userEdgeMotion, lineStyle: userEdgeLineStyle },
      { type: assistantEdgeType, motion: assistantEdgeMotion, lineStyle: assistantEdgeLineStyle }
    ).map((edge) => {
      if (!compactingNodeIds.has(edge.source) && !compactingNodeIds.has(edge.target)) {
        return edge;
      }
      return {
        ...edge,
        animated: false,
        style: {
          ...(edge.style ?? {}),
          opacity: 0.35,
          pointerEvents: "none",
        },
      };
    });
  }, [
    compactingNodeIds,
    edges,
    hiddenNodeIds,
    nodesById,
    userEdgeType,
    userEdgeMotion,
    userEdgeLineStyle,
    assistantEdgeType,
    assistantEdgeMotion,
    assistantEdgeLineStyle,
  ]);

  const applyFoldForEdge = useCallback(
    (edge: Edge): boolean => {
      return applyFoldForEdgeWithController(edge, {
        nodesById,
        hiddenNodeIds,
        collapsedTargets,
        getSubtreeNodeIds,
        collapseByEdge,
        unfoldSubtree,
      });
    },
    [collapseByEdge, collapsedTargets, getSubtreeNodeIds, hiddenNodeIds, nodesById, unfoldSubtree]
  );

  const desktopGridCols = panelOpen ? "md:grid-cols-[16rem_minmax(0,1fr)_420px]" : "md:grid-cols-[16rem_minmax(0,1fr)]";

  return (
    <div
      className={`relative grid h-full w-full min-h-0 grid-rows-[auto_1fr_auto] overflow-hidden ${desktopGridCols} ${
        fixedMode ? "fixed-layout-animated" : ""
      }`}
    >
      <div className="row-start-1 col-span-full">
        <AppHeader
          title={title}
          responseSource={responseSource}
          apiKeyInput={apiKeyInput}
          onApiKeyInputChange={setApiKeyInput}
          onSaveApiKey={() => {
            if (!apiKeyInput.trim()) return;
            void setSessionApiKey(apiKeyInput.trim());
            setApiKeyInput("");
          }}
          modelOptions={availableModels}
          selectedModel={selectedModel}
          onSelectedModelChange={setSelectedModel}
          onNewChat={() => void startNewChat()}
          onToggleHistory={() => setMobileHistoryOpen(true)}
        />
      </div>

      <aside className="hidden min-h-0 md:col-start-1 md:row-start-2 md:row-end-4 md:block">
        <PreviousChatsSidebar
          graphId={graphId}
          chats={previousChats}
          onSelect={(targetGraphId) => void selectChatFromHistory(targetGraphId)}
          onRename={(chat) => void handleRenameChat(chat)}
          onDelete={(chat) => void handleDeleteChat(chat)}
          onDeleteAll={() => void handleDeleteAllChats()}
        />
      </aside>

      {mobileHistoryOpen && (
        <div className="absolute inset-0 z-[1200] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close chat history"
            onClick={() => setMobileHistoryOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-[20rem]">
            <PreviousChatsSidebar
              graphId={graphId}
              chats={previousChats}
              onSelect={(targetGraphId) => void selectChatFromHistory(targetGraphId)}
              onRename={(chat) => void handleRenameChat(chat)}
              onDelete={(chat) => void handleDeleteChat(chat)}
              onDeleteAll={() => void handleDeleteAllChats()}
              onClose={() => setMobileHistoryOpen(false)}
            />
          </div>
        </div>
      )}

      <main ref={mainRef} className="relative min-h-0 row-start-2 md:col-start-2 md:row-start-2">
        <LayoutControlsPanel
          visible={fixedMode && layoutPanelOpen}
          position={layoutPanelPosition}
          tab={layoutSliderTab}
          setTab={setLayoutSliderTab}
          onClose={() => setLayoutPanelOpen(false)}
          rowGap={rowGap}
          setRowGap={setRowGap}
          rowGapDefault={FIXED_ROW_GAP}
          siblingGap={siblingGap}
          setSiblingGap={setSiblingGap}
          siblingGapDefault={FIXED_MIN_COL_GAP}
          treeGap={treeGap}
          setTreeGap={setTreeGap}
          treeGapDefault={FIXED_TREE_GAP}
          fitViewPadding={fitViewPadding}
          setFitViewPadding={setFitViewPadding}
          fitViewPaddingDefault={DEFAULT_FIT_VIEW_BUTTON_PADDING}
          assistantWheelHoldMs={assistantWheelHoldMs}
          setAssistantWheelHoldMs={setAssistantWheelHoldMs}
          assistantWheelHoldDefault={DEFAULT_ASSISTANT_WHEEL_HOLD_MS}
          fallbackDelayMs={fallbackDelayMs}
          setFallbackDelayMs={setFallbackDelayMs}
          fallbackDelayDefault={0}
          nodeMinWidth={nodeMinWidth}
          setNodeMinWidth={setNodeMinWidth}
          nodeMinWidthDefault={NODE_MIN_WIDTH_DEFAULT}
          nodeMaxWidth={nodeMaxWidth}
          setNodeMaxWidth={setNodeMaxWidth}
          nodeMaxWidthDefault={NODE_MAX_WIDTH_DEFAULT}
          nodeMaxWidthUnitPx={NODE_MAX_WIDTH_UNIT_PX}
          nodeStepChars={nodeStepChars}
          setNodeStepChars={setNodeStepChars}
          nodeStepPx={nodeStepPx}
          setNodeStepPx={setNodeStepPx}
          userEdgeType={userEdgeType}
          setUserEdgeType={setUserEdgeType}
          userEdgeMotion={userEdgeMotion}
          setUserEdgeMotion={setUserEdgeMotion}
          userEdgeLineStyle={userEdgeLineStyle}
          setUserEdgeLineStyle={setUserEdgeLineStyle}
          assistantEdgeType={assistantEdgeType}
          setAssistantEdgeType={setAssistantEdgeType}
          assistantEdgeMotion={assistantEdgeMotion}
          setAssistantEdgeMotion={setAssistantEdgeMotion}
          assistantEdgeLineStyle={assistantEdgeLineStyle}
          setAssistantEdgeLineStyle={setAssistantEdgeLineStyle}
        />
        <div className="h-full w-full">
          <ReactFlow
            nodes={uiNodes}
            edges={uiEdges}
          nodeOrigin={[NODE_ORIGIN_X, NODE_ORIGIN_Y]}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgeClick={(event, edge) => {
              if (compactingNodeIds.has(edge.source) || compactingNodeIds.has(edge.target)) {
                return;
              }
              if (!applyFoldForEdge(edge)) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
            }}
            onNodeClick={(event, node) => {
              if ("button" in event && event.button !== 0) {
                return;
              }
              if ((node.data as GraphNodeUiData).compacting) {
                return;
              }
              if (node.type === "collapsedNode") {
                return;
              }
              setSelectedNode(node.id);
              setNodeContextMenuNodeId(null);
            }}
            onNodeDoubleClick={(event, node) => {
              if ((node.data as GraphNodeUiData).compacting) {
                return;
              }
              const target = event.target;
              if (target instanceof Element && target.closest('[data-node-text-content="true"]')) {
                return;
              }
              const selection = window.getSelection();
              if (selection && !selection.isCollapsed) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              if (node.type === "collapsedNode") {
                return;
              }
              applyFoldForNodeWithController(node.id, uiEdges, applyFoldForEdge);
            }}
            onPaneClick={() => {
              setNodeContextMenuNodeId(null);
              if (panelOpen) {
                return;
              }
              if (performance.now() < suppressPaneClearUntilRef.current) {
                return;
              }
              setSelectedNode(null);
            }}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            nodesDraggable={!fixedMode}
            panOnDrag
            zoomOnScroll={!wheelHoverActive}
            zoomOnDoubleClick={!fixedMode}
          >
            <Background color="#d6d0c5" gap={18} />
            {!panelOpen && <MiniMap position="top-right" />}
            <Controls
              position="top-left"
              fitViewOptions={FIT_VIEW_OPTIONS}
              showInteractive={false}
              showFitView={false}
              showZoom={false}
            >
              <ControlButton
                onClick={() => zoomIn(ZOOM_BUTTON_FACTOR)}
                title="Zoom in"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M10 5v10M5 10h10" strokeLinecap="round" />
                </svg>
              </ControlButton>
              <ControlButton
                onClick={() => zoomOut(ZOOM_BUTTON_FACTOR)}
                title="Zoom out"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 10h10" strokeLinecap="round" />
                </svg>
              </ControlButton>
              <ControlButton onClick={fitCanvasToGraph} title="Fit view">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M7 4H4v3M13 4h3v3M4 13v3h3M16 13v3h-3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 8h4v4H8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </ControlButton>
              <ControlButton
                onClick={() => setLayoutPanelOpen((value) => !value)}
                title={fixedMode ? "Toggle layout sliders" : "Layout sliders are available in fixed mode"}
                disabled={!fixedMode}
                className={`${!fixedMode ? "opacity-40 cursor-not-allowed" : ""} ${
                  fixedMode && layoutPanelOpen ? "!bg-accent/15 !text-accent" : ""
                }`}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 5h12M4 10h12M4 15h12" strokeLinecap="round" />
                  <circle cx="8" cy="5" r="1.7" />
                  <circle cx="12.5" cy="10" r="1.7" />
                  <circle cx="6.5" cy="15" r="1.7" />
                </svg>
              </ControlButton>
              <ControlButton
                onClick={toggleLayoutMode}
                title={fixedMode ? "Switch to Free Layout" : "Switch to Fixed Layout"}
                className={fixedMode ? "!bg-accent/15 !text-accent" : ""}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6.5 9V6.8a3.5 3.5 0 1 1 7 0V9" strokeLinecap="round" />
                  <rect x="5" y="9" width="10" height="7" rx="1.2" />
                </svg>
              </ControlButton>
            </Controls>
          </ReactFlow>
        </div>
      </main>

      {panelOpen && (
        <aside className="hidden min-h-0 md:col-start-3 md:row-start-2 md:row-end-4 md:block">
          <ContextPanel
            open={panelOpen}
            transcript={transcript}
            panelText={panelText}
            canCycleLastAssistantVariant={canCyclePanelAnchorVariant}
            lastAssistantVariantIndex={panelAnchorVariantIndex}
            onCycleLastAssistantVariant={(direction) => {
              if (!panelAnchorNodeId) return;
              void cycleVariant(panelAnchorNodeId, direction);
            }}
            onApproveLastAssistantVariant={() => {
              if (!panelAnchorNodeId) return;
              approveVariant(panelAnchorNodeId);
            }}
            onClose={() => {
              setPanelOpen(false);
              setPanelAnchorNodeId(null);
            }}
            onPanelTextChange={setPanelText}
            onSend={() => void sendPanelContinue()}
          />
        </aside>
      )}

      {panelOpen && (
        <div className="absolute inset-0 z-[1200] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close context chat"
            onClick={() => {
              setPanelOpen(false);
              setPanelAnchorNodeId(null);
            }}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-[420px]">
            <ContextPanel
              open={panelOpen}
              transcript={transcript}
              panelText={panelText}
              canCycleLastAssistantVariant={canCyclePanelAnchorVariant}
              lastAssistantVariantIndex={panelAnchorVariantIndex}
              onCycleLastAssistantVariant={(direction) => {
                if (!panelAnchorNodeId) return;
                void cycleVariant(panelAnchorNodeId, direction);
              }}
              onApproveLastAssistantVariant={() => {
                if (!panelAnchorNodeId) return;
                approveVariant(panelAnchorNodeId);
              }}
              onClose={() => {
                setPanelOpen(false);
                setPanelAnchorNodeId(null);
              }}
              onPanelTextChange={setPanelText}
              onSend={() => void sendPanelContinue()}
            />
          </div>
        </div>
      )}

      <ElaborateButton
        action={elaborateAction}
        onElaborateClick={(action) => {
          const nextNodes = addElaboratedSelection(action.nodeId, action.text, action.occurrence ?? 0);
          nodesRef.current = nextNodes;
          setSelectedNode(action.nodeId);
          void sendContinue("elaboration", action.text);
        }}
        onClose={() => setElaborateAction(null)}
      />

      <WheelModeBanner
        visible={!!wheelHoverNodeId}
        active={wheelHoverActive}
        holdMs={assistantWheelHoldMs}
        progress={wheelHoverProgress}
      />

      <div className="row-start-3 md:col-start-2 md:row-start-3">
        <ComposerBar
        selectedNodeId={selectedNodeId}
        selectedNodePending={selectedNode?.data.pending === true}
        showFullSelectedNodeId={showFullSelectedNodeId}
        composerText={composerText}
        loading={loading}
        inputRef={composerInputRef}
        onToggleSelectedNodeIdMode={() => setShowFullSelectedNodeId((value) => !value)}
        onComposerTextChange={setComposerText}
        onSend={() => void sendContinue("normal")}
        />
      </div>

      <ModelResponseBanner visible={modelResponseLoading && hasPendingAssistant} />
      {error && <div className="absolute bottom-14 left-3 z-30 rounded bg-red-100 px-3 py-2 text-xs text-red-800">{error}</div>}
    </div>
  );
}
