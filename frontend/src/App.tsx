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
  generateGraphTitle,
  getGraph,
  lockVariant,
  listAvailableModels,
  reviseSelectedText,
  setSessionApiKey,
  updateGraphCollapsedState,
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
import { type ActionPreviewKind, type ActionPreviewStyle } from "./features/graph/actionPreview";
import { buildDeleteProjection } from "./features/graph/deleteProjection";
import { type EdgeLineStyleValue, type EdgeMotionValue, type EdgeTypeValue } from "./features/graph/edgeStyles";
import { buildNodeDisplayText } from "./features/graph/nodeTextPreview";
import { applyFoldForEdgeWithController, applyFoldForNodeWithController } from "./features/graph/foldController";
import { buildNodeMap, getAssistantNodesWithUserBranch } from "./features/graph/nodeSelectors";
import type { GraphNodeUiData } from "./features/graph/nodeUi";
import {
  type ElaborateAction,
} from "./features/selection/menu";
import { useSelectionMenu } from "./features/selection/useSelectionMenu";
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

export default function App() {
  const {
    graphId,
    title,
    titleState,
    nodes,
    edges,
    selectedNodeId,
    panelOpen,
    transcript,
    responseSource,
    setGraph,
    setTitle,
    appendEntities,
    setSelectedNode,
    setNodes,
    setEdges,
    updateNodeVariant: updateVariantLocal,
    lockNodeVariant,
    setPanelOpen,
    setTranscript,
    setResponseSource,
  } = useGraphStore();

  const [composerText, setComposerText] = useState("");
  const [panelText, setPanelText] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelResponseLoading, setModelResponseLoading] = useState(false);
  const [llmTasks, setLlmTasks] = useState<Array<{ id: string; label: string }>>([]);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("fallback");
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
  const [actionPreviewStyle, setActionPreviewStyle] = useState<ActionPreviewStyle>("outline");
  const [showCanvasGrid, setShowCanvasGrid] = useState(false);
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
  const [actionPreviewNodeIds, setActionPreviewNodeIds] = useState<Set<string>>(new Set());
  const [expandedTextNodeIds, setExpandedTextNodeIds] = useState<Set<string>>(new Set());
  const [compactingNodeIds, setCompactingNodeIds] = useState<Set<string>>(new Set());
  const { elaborateAction, setElaborateAction, clearElaborateAction } = useSelectionMenu();
  const {
    collapsedTargets,
    collapsedEdgeSources,
    setCollapsedTargets,
    setCollapsedEdgeSources,
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
  const collapseHydratedRef = useRef(false);
  const collapsePersistTimerRef = useRef<number | null>(null);
  const collapsePersistSignatureRef = useRef<string>("");
  const autoNamingGraphIdRef = useRef<string | null>(null);

  const buildCollapsedStateSignature = useCallback(
    (targets: Iterable<string>, edgeSources: Iterable<[string, string]>) =>
      JSON.stringify({
        collapsedTargets: Array.from(targets).sort(),
        collapsedEdgeSources: Array.from(edgeSources).sort(([a], [b]) => a.localeCompare(b)),
      }),
    []
  );

  const applyCollapsedState = useCallback(
    (targets: string[], edgeSources: Record<string, string>) => {
      const collapsedTargetsSet = new Set(targets);
      const collapsedEdgeSourcesMap = new Map(Object.entries(edgeSources));
      collapseHydratedRef.current = false;
      if (collapsePersistTimerRef.current !== null) {
        window.clearTimeout(collapsePersistTimerRef.current);
        collapsePersistTimerRef.current = null;
      }
      collapsePersistSignatureRef.current = buildCollapsedStateSignature(
        collapsedTargetsSet,
        collapsedEdgeSourcesMap.entries()
      );
      setCollapsedTargets(collapsedTargetsSet);
      setCollapsedEdgeSources(collapsedEdgeSourcesMap);
      requestAnimationFrame(() => {
        collapseHydratedRef.current = true;
      });
    },
    [buildCollapsedStateSignature, setCollapsedEdgeSources, setCollapsedTargets]
  );

  const startLlmTask = useCallback((label: string) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setLlmTasks((prev) => [...prev, { id, label }]);
    return id;
  }, []);

  const finishLlmTask = useCallback((taskId: string | null) => {
    if (!taskId) {
      return;
    }
    setLlmTasks((prev) => prev.filter((task) => task.id !== taskId));
  }, []);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

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
    setActionPreviewNodeIds(new Set());
    setExpandedTextNodeIds(new Set());
    setCompactingNodeIds(new Set());
    compactingCountsRef.current = new Map();
    autoNamingGraphIdRef.current = null;
  }, [graphId]);

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

  const { fitCanvasToGraph, centerNodeInView, zoomIn, zoomOut } = useViewportControls({
    reactFlowInstance,
    mainElement: mainRef.current,
    fitViewPadding,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    nodeOriginX: NODE_ORIGIN_X,
    nodeOriginY: NODE_ORIGIN_Y,
  });

  const handleMiniMapClick = useCallback(
    (_event: MouseEvent | React.MouseEvent<Element, MouseEvent>, position: { x: number; y: number }) => {
      if (!reactFlowInstance) {
        return;
      }

      void reactFlowInstance.setCenter(position.x, position.y, {
        zoom: reactFlowInstance.getZoom(),
        duration: 180,
      });
    },
    [reactFlowInstance],
  );

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
    setNodeSizes((current) => {
      if (current.size !== next.size) {
        return next;
      }
      for (const [id, size] of next) {
        const existing = current.get(id);
        if (!existing || existing.width !== size.width || existing.height !== size.height) {
          return next;
        }
      }
      return current;
    });
  }, [reactFlowInstance]);

  const {
    previousChats,
    autoRenamingChatIds,
    refreshGraphList,
    loadGraph,
    startNewChat,
    selectChatFromHistory,
    handleRenameChat,
    handleAutoRenameChat,
    handleDeleteChat,
    handleDeleteAllChats,
  } = useGraphSessions({
    graphId,
    nodesCount: nodes.length,
    setGraph,
    applyCollapsedState,
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
    selectedModel,
    startLlmTask,
    finishLlmTask,
  });

  useGraphBootstrap({
    setLoading,
    setError,
    setGraph,
    applyCollapsedState,
    fitCanvasToGraph,
    refreshGraphList,
  });

  const maybeAutoNameGraph = useCallback(
    async (nextNodes: Node<NodeData>[]) => {
      if (!graphId || titleState !== "untitled") {
        return;
      }
      const userNodeCount = nextNodes.filter((node) => node.data.role === "user" && !node.data.pending).length;
      if (userNodeCount < 3) {
        return;
      }
      if (autoNamingGraphIdRef.current === graphId) {
        return;
      }
      autoNamingGraphIdRef.current = graphId;
      let llmTaskId: string | null = null;
      try {
        llmTaskId = startLlmTask("Generating chat title");
        const response = await generateGraphTitle(graphId, selectedModel);
        setTitle(response.title, response.title_state);
        await refreshGraphList();
      } catch {
        // Keep conversation flow intact even if title generation fails.
      } finally {
        finishLlmTask(llmTaskId);
      }
    },
    [finishLlmTask, graphId, refreshGraphList, selectedModel, setTitle, startLlmTask, titleState]
  );

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

  const getPathNodeIds = useCallback(
    (startNodeId: string) => {
      const ids = new Set<string>();
      let cursor: string | null = startNodeId;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        ids.add(cursor);
        cursor = nodesById.get(cursor)?.data.parentId ?? null;
      }
      return ids;
    },
    [nodesById]
  );

  const clearActionPreview = useCallback(() => {
    setActionPreviewNodeIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const previewActionForNode = useCallback(
    (nodeId: string, action: ActionPreviewKind) => {
      const next =
        action === "context" || action === "extract" ? getPathNodeIds(nodeId) : getSubtreeNodeIds(nodeId);
      setActionPreviewNodeIds(next);
    },
    [getPathNodeIds, getSubtreeNodeIds]
  );

  const toggleExpandedText = useCallback((nodeId: string) => {
    setExpandedTextNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
    requestAnimationFrame(() => {
      refreshMeasuredNodeSizes();
    });
  }, [refreshMeasuredNodeSizes]);

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

  useEffect(() => {
    if (!graphId || !collapseHydratedRef.current) {
      return;
    }
    const signature = buildCollapsedStateSignature(collapsedTargets, collapsedEdgeSources.entries());
    if (signature === collapsePersistSignatureRef.current) {
      return;
    }
    if (collapsePersistTimerRef.current !== null) {
      window.clearTimeout(collapsePersistTimerRef.current);
    }
    collapsePersistTimerRef.current = window.setTimeout(() => {
      collapsePersistSignatureRef.current = signature;
      void updateGraphCollapsedState(
        graphId,
        Array.from(collapsedTargets),
        Object.fromEntries(collapsedEdgeSources.entries())
      );
      collapsePersistTimerRef.current = null;
    }, 180);
    return () => {
      if (collapsePersistTimerRef.current !== null) {
        window.clearTimeout(collapsePersistTimerRef.current);
        collapsePersistTimerRef.current = null;
      }
    };
  }, [buildCollapsedStateSignature, collapsedEdgeSources, collapsedTargets, graphId]);

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
    async (nodeId: string) => {
      const node = nodesById.get(nodeId);
      lockNodeVariant(nodeId);
      const currentVariantIndex = node?.data.variantIndex ?? 0;
      try {
        await lockVariant(nodeId, currentVariantIndex);
      } catch {
        // Keep UI optimistic even if persistence update fails.
      }
      if (wheelHoverNodeId === nodeId) {
        clearAssistantWheelHover();
      }
    },
    [clearAssistantWheelHover, lockNodeVariant, nodesById, wheelHoverNodeId]
  );

  const canKeyboardCycleSelectedAssistant = useMemo(() => {
    if (!selectedNodeId) {
      return false;
    }
    const node = nodesById.get(selectedNodeId);
    return !!(
      node &&
      node.data.role === "assistant" &&
      node.data.variants &&
      !node.data.variantLocked &&
      !node.data.pending
    );
  }, [nodesById, selectedNodeId]);

  useEffect(() => {
    const isEditableTarget = (element: HTMLElement | null) =>
      !!element &&
      (element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.isContentEditable);

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      if (isEditableTarget(active)) {
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key === "ArrowUp" && selectedNodeId && canKeyboardCycleSelectedAssistant) {
          event.preventDefault();
          void cycleVariant(selectedNodeId, -1);
          return;
        }
        if (event.key === "ArrowDown" && selectedNodeId && canKeyboardCycleSelectedAssistant) {
          event.preventDefault();
          void cycleVariant(selectedNodeId, 1);
          return;
        }
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (event.key.length !== 1) {
        return;
      }
      event.preventDefault();
      composerInputRef.current?.focus();
      setComposerText((prev) => prev + event.key);
    };

    const onWindowPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      if (isEditableTarget(active)) {
        return;
      }
      const text = event.clipboardData?.getData("text");
      if (!text) {
        return;
      }
      event.preventDefault();
      composerInputRef.current?.focus();
      setComposerText((prev) => prev + text);
    };

    window.addEventListener("keydown", onWindowKeyDown);
    window.addEventListener("paste", onWindowPaste);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
      window.removeEventListener("paste", onWindowPaste);
    };
  }, [canKeyboardCycleSelectedAssistant, cycleVariant, selectedNodeId]);

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
      clearActionPreview();
      const target = event.target;
      if (target instanceof Element && target.closest('[data-node-action-button="true"]')) {
        return;
      }
      setNodeContextMenuNodeId(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [clearActionPreview, nodeContextMenuNodeId]);

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
    clearElaborateAction,
    startLlmTask,
    finishLlmTask,
    maybeAutoNameGraph,
    centerNodeInView,
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
        let llmTaskId: string | null = null;
        setLoading(true);
        setError(null);
        setNodeContextMenuNodeId(null);
        addCompactingNodeIds(idsToCompact);
        try {
          llmTaskId = startLlmTask("Compacting branch");
          const response = await compactBranch(nodeId, selectedModel);
        if (selectedModel === "fallback" && fallbackDelayMs > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, fallbackDelayMs));
        }
          setGraph(response.graph_id, response.title, response.title_state, response.nodes, response.edges);
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
          finishLlmTask(llmTaskId);
          removeCompactingNodeIds(idsToCompact);
          setLoading(false);
        }
      },
    [
      addCompactingNodeIds,
        elaborateAction,
        finishLlmTask,
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
        startLlmTask,
      ]
    );

  const handleReviseSelectedText = useCallback(
    async (action: ElaborateAction) => {
      if (!graphId || action.role !== "user") {
        return;
      }

      let llmTaskId: string | null = null;
      setLoading(true);
      setError(null);
      try {
        llmTaskId = startLlmTask("Revising selected text");
        const response = await reviseSelectedText(action.nodeId, action.text, action.occurrence, selectedModel);
        if (selectedModel === "fallback" && fallbackDelayMs > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, fallbackDelayMs));
        }
        const nextNodes = nodesRef.current.map((node) =>
          node.id === response.updated_node.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  text: response.updated_node.text,
                },
              }
            : node
        );
        nodesRef.current = nextNodes;
        setNodes(nextNodes);
        setResponseSource(response.response_source);
        setElaborateAction(null);
        await refreshGraphList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to revise selected text");
      } finally {
        finishLlmTask(llmTaskId);
        setLoading(false);
      }
    },
    [
      fallbackDelayMs,
      finishLlmTask,
      graphId,
      refreshGraphList,
      selectedModel,
      setNodes,
      setResponseSource,
      startLlmTask,
    ],
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
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => refreshMeasuredNodeSizes());
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [fixedMode, reactFlowInstance, refreshMeasuredNodeSizes, nodes]);

  useEffect(() => {
    if (!fixedMode || !reactFlowInstance) return;
    const raf = requestAnimationFrame(() => refreshMeasuredNodeSizes());
    return () => {
      cancelAnimationFrame(raf);
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
    () =>
      buildLayoutNodes(nodes, hiddenNodeIds, collapsedProxyTargets).map((node) => {
        const expanded = expandedTextNodeIds.has(node.id);
        const display = buildNodeDisplayText(node.data.text ?? "", expanded);
        return {
          ...node,
          data: {
            ...node.data,
            text: display.text,
          },
        };
      }),
    [collapsedProxyTargets, expandedTextNodeIds, hiddenNodeIds, nodes]
  );
  const layoutNodeSizes = useMemo(
    () => buildLayoutNodeSizes(nodeSizes, collapsedProxyTargets, COLLAPSED_NODE_SIZE),
    [collapsedProxyTargets, nodeSizes]
  );

  const structure = useMemo(
    () => buildFixedPositions(layoutNodes, layoutNodeSizes, { rowGap, treeGap, siblingGap, preferredAnchorNodeId: selectedNodeId }),
    [layoutNodeSizes, layoutNodes, rowGap, selectedNodeId, siblingGap, treeGap]
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
          const expanded = expandedTextNodeIds.has(node.id);
          const display = buildNodeDisplayText(node.data.text ?? "", expanded);

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
              displayText: display.text,
              textExpandable: display.expandable,
              textExpanded: expanded,
              compacting: compactingNodeIds.has(node.id),
              actionPreviewActive: actionPreviewNodeIds.has(node.id),
              actionPreviewStyle,
              elaboratedSelections: node.data.elaboratedSelections ?? [],
              sizingSignature: nodeSizingSignature,
              layer: structure.meta.get(node.id)?.layer ?? 0,
              siblingOrder: structure.meta.get(node.id)?.siblingOrder ?? 0,
              variantLocked: assistantWithBranch.has(node.id) || node.data.variantLocked === true,
              onCycleVariant: cycleVariant,
              onApproveVariant: approveVariant,
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
                clearActionPreview();
                setSelectedNode(nodeId);
                setNodeContextMenuNodeId((prev) => (prev === nodeId ? null : nodeId));
              },
              onActionPreviewStart: (nodeId: string, action: ActionPreviewKind) => {
                previewActionForNode(nodeId, action);
              },
              onActionPreviewEnd: () => {
                clearActionPreview();
              },
              onToggleExpandedText: (nodeId: string) => {
                toggleExpandedText(nodeId);
              },
            } as GraphNodeUiData,
          };
        });
      return baseNodes;
    },
    [
      assistantWithBranch,
      approveVariant,
      actionPreviewNodeIds,
      actionPreviewStyle,
      collapsedProxyTargets,
      clearActionPreview,
      cycleVariant,
      expandedTextNodeIds,
      fixedMode,
      getSubtreeNodeIds,
      handleAssistantHoverEnd,
      handleAssistantHoverStart,
      handleAssistantWheel,
      compactingNodeIds,
      hiddenNodeIds,
      previewActionForNode,
      nodes,
      panelAnchorNodeId,
      panelOpen,
      nodeSizingSignature,
      setPanelOpen,
      setSelectedNode,
      selectedNodeId,
      setTranscript,
      structure,
      toggleExpandedText,
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
          onAutoRename={(chat) => void handleAutoRenameChat(chat)}
          autoRenamingChatIds={autoRenamingChatIds}
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
              onAutoRename={(chat) => void handleAutoRenameChat(chat)}
              autoRenamingChatIds={autoRenamingChatIds}
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
          actionPreviewStyle={actionPreviewStyle}
          setActionPreviewStyle={setActionPreviewStyle}
          showCanvasGrid={showCanvasGrid}
          setShowCanvasGrid={setShowCanvasGrid}
        />
        <div className="h-full w-full">
          <ReactFlow
            nodes={uiNodes}
            edges={uiEdges}
          nodeOrigin={[NODE_ORIGIN_X, NODE_ORIGIN_Y]}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgeClick={(event, edge) => {
              clearActionPreview();
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
              clearActionPreview();
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
              clearActionPreview();
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
              clearActionPreview();
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
            nodesFocusable={false}
            nodesDraggable={!fixedMode}
            panOnDrag
            zoomOnScroll={!wheelHoverActive}
            zoomOnDoubleClick={!fixedMode}
          >
            <Background color="#d6d0c5" gap={18} />
            {!panelOpen && <MiniMap position="top-right" pannable onClick={handleMiniMapClick} />}
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
          {showCanvasGrid && (
            <div className="pointer-events-none absolute inset-0 z-[450] grid grid-cols-4 grid-rows-4">
              {Array.from({ length: 16 }, (_, index) => (
                <div key={`canvas-grid-${index}`} className="border border-red-500/70" />
              ))}
            </div>
          )}
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
          setSelectedNode(action.nodeId);
          void sendContinue("elaboration", action.text);
        }}
        onReviseClick={(action) => {
          void handleReviseSelectedText(action);
        }}
        onClose={clearElaborateAction}
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

      <ModelResponseBanner tasks={llmTasks} />
      {error && <div className="absolute bottom-14 left-3 z-30 rounded bg-red-100 px-3 py-2 text-xs text-red-800">{error}</div>}
    </div>
  );
}
