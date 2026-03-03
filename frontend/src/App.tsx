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
  deleteNodeSubtree,
  getGraph,
  setSessionApiKey,
  updateVariant,
} from "./api/client";
import ElaborateButton from "./components/common/ElaborateButton";
import ContextPanel from "./components/panels/ContextPanel";
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
  isFoldableEdge,
  buildLayoutNodeSizes,
  buildLayoutNodes,
  buildProjectedUiEdges,
  collectSubtreeNodeIds,
  pruneCollapsedEdgeSources,
  pruneCollapsedTargets,
} from "./features/graph/collapseProjection";
import { COLLAPSED_NODE_PREFIX, COLLAPSED_NODE_SIZE } from "./features/graph/constants";
import { buildDeleteProjection } from "./features/graph/deleteProjection";
import {
  EDGE_LINE_STYLE_OPTIONS,
  EDGE_MOTION_OPTIONS,
  EDGE_TYPE_OPTIONS,
  type EdgeLineStyleValue,
  type EdgeMotionValue,
  type EdgeTypeValue,
} from "./features/graph/edgeStyles";
import { buildNodeMap, getAssistantNodesWithUserBranch } from "./features/graph/nodeSelectors";
import {
  FIT_VIEW_OPTIONS,
  FIXED_MIN_COL_GAP,
  FIXED_ROW_GAP,
  FIXED_TREE_GAP,
} from "./features/layout/constants";
import { buildFixedPositions } from "./features/layout/layoutEngine";
import { useViewportControls } from "./features/layout/useViewportControls";
import { useCollapsedBranches } from "./features/graph/useCollapsedBranches";
import { useGraphStore, type NodeData } from "./store/useGraphStore";

interface ElaborateAction {
  nodeId: string;
  text: string;
  x: number;
  y: number;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 2.5;
const DEFAULT_FIT_VIEW_BUTTON_PADDING = 0.05;
const ZOOM_BUTTON_FACTOR = 1.75;
const DEFAULT_ASSISTANT_WHEEL_HOLD_MS = 0;
const ASSISTANT_WHEEL_STEP_COOLDOWN_MS = 140;
const NODE_ORIGIN_X = 0.5;
const NODE_ORIGIN_Y = 0;

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
    setPanelOpen,
    setTranscript,
    setResponseSource,
  } = useGraphStore();

  const [composerText, setComposerText] = useState("");
  const [panelText, setPanelText] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [elaborateAction, setElaborateAction] = useState<ElaborateAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [fixedMode, setFixedMode] = useState(true);
  const [nodeSizes, setNodeSizes] = useState<Map<string, { width: number; height: number }>>(new Map());
  const [fitViewPadding, setFitViewPadding] = useState(DEFAULT_FIT_VIEW_BUTTON_PADDING);
  const [rowGap, setRowGap] = useState(FIXED_ROW_GAP);
  const [treeGap, setTreeGap] = useState(FIXED_TREE_GAP);
  const [siblingGap, setSiblingGap] = useState(FIXED_MIN_COL_GAP);
  const [assistantWheelHoldMs, setAssistantWheelHoldMs] = useState(DEFAULT_ASSISTANT_WHEEL_HOLD_MS);
  const [userEdgeType, setUserEdgeType] = useState<EdgeTypeValue>("default");
  const [assistantEdgeType, setAssistantEdgeType] = useState<EdgeTypeValue>("default");
  const [userEdgeMotion, setUserEdgeMotion] = useState<EdgeMotionValue>("animated");
  const [assistantEdgeMotion, setAssistantEdgeMotion] = useState<EdgeMotionValue>("static");
  const [userEdgeLineStyle, setUserEdgeLineStyle] = useState<EdgeLineStyleValue>("dashed");
  const [assistantEdgeLineStyle, setAssistantEdgeLineStyle] = useState<EdgeLineStyleValue>("solid");
  const [layoutPanelOpen, setLayoutPanelOpen] = useState(false);
  const [layoutPanelPosition, setLayoutPanelPosition] = useState({ left: 120, top: 56 });
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [panelAnchorNodeId, setPanelAnchorNodeId] = useState<string | null>(null);
  const [showFullSelectedNodeId, setShowFullSelectedNodeId] = useState(false);
  const [wheelHoverNodeId, setWheelHoverNodeId] = useState<string | null>(null);
  const [wheelHoverProgress, setWheelHoverProgress] = useState(0);
  const [wheelHoverActive, setWheelHoverActive] = useState(false);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const {
    collapsedTargets,
    collapsedEdgeSources,
    setCollapsedTargets,
    setCollapsedEdgeSources,
    resetCollapsed,
    collapseByEdge,
    unfoldSubtree,
  } = useCollapsedBranches();
  const composerInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const nodeContextMenuRef = useRef<HTMLDivElement>(null);

  const manualPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const nodesRef = useRef(nodes);
  const wheelHoverStartRef = useRef<number>(0);
  const wheelHoverRafRef = useRef<number | null>(null);
  const wheelLastStepAtRef = useRef(0);
  const suppressPaneClearUntilRef = useRef(0);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

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
    manualPositionsRef.current = new Map();
    setNodeSizes(new Map());
    resetCollapsed();
  }, [graphId, resetCollapsed]);

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
    (nodeId: string, deltaY: number) => {
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
    if (!nodeContextMenu) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!nodeContextMenuRef.current) {
        return;
      }
      if (event.target instanceof globalThis.Node && nodeContextMenuRef.current.contains(event.target)) {
        return;
      }
      setNodeContextMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [nodeContextMenu]);

  const { sendContinue, sendPanelContinue } = useConversationActions({
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
      setNodeContextMenu(null);

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

  useEffect(() => {
    if (!wheelHoverNodeId) return;
    const hoveredNode = nodesById.get(wheelHoverNodeId);
    const nodeIsEligible =
      hoveredNode?.data.role === "assistant" &&
      !!hoveredNode.data.variants &&
      !assistantWithBranch.has(wheelHoverNodeId);
    if (!nodeIsEligible) {
      clearAssistantWheelHover();
    }
  }, [assistantWithBranch, clearAssistantWheelHover, nodesById, wheelHoverNodeId]);

  useEffect(() => {
    if (!panelOpen || !panelAnchorNodeId) return;
    const synced = buildTranscriptUntilNode(nodesRef.current, panelAnchorNodeId);
    if (synced.length === 0) return;
    setTranscript(synced);
  }, [panelAnchorNodeId, panelOpen, setTranscript, nodes]);

  const hiddenNodeIds = useMemo(() => buildHiddenNodeIds(collapsedTargets, getSubtreeNodeIds), [collapsedTargets, getSubtreeNodeIds]);
  const collapsedProxyTargets = useMemo(
    () => buildCollapsedProxyTargets(collapsedTargets, hiddenNodeIds, nodesById),
    [collapsedTargets, hiddenNodeIds, nodesById]
  );
  const layoutNodes = useMemo(
    () => buildLayoutNodes(nodes, edges, hiddenNodeIds, collapsedProxyTargets, collapsedEdgeSources, COLLAPSED_NODE_PREFIX),
    [collapsedEdgeSources, collapsedProxyTargets, edges, hiddenNodeIds, nodes]
  );
  const layoutNodeSizes = useMemo(
    () => buildLayoutNodeSizes(nodeSizes, collapsedProxyTargets, COLLAPSED_NODE_PREFIX, COLLAPSED_NODE_SIZE),
    [collapsedProxyTargets, nodeSizes]
  );

  const structure = useMemo(
    () => buildFixedPositions(layoutNodes, layoutNodeSizes, { rowGap, treeGap, siblingGap }),
    [layoutNodeSizes, layoutNodes, rowGap, siblingGap, treeGap]
  );

  const uiNodes: Node<NodeData | { label: string; hiddenCount: number; onUnfold: () => void }>[] = useMemo(
    () => {
      const baseNodes = nodes
        .filter((node) => !hiddenNodeIds.has(node.id))
        .map((node) => ({
        ...node,
        position: fixedMode ? structure.positions.get(node.id) ?? node.position : node.position,
        data: {
          ...node.data,
          layer: structure.meta.get(node.id)?.layer ?? 0,
          siblingOrder: structure.meta.get(node.id)?.siblingOrder ?? 0,
          variantLocked: assistantWithBranch.has(node.id),
          onCycleVariant: cycleVariant,
          onSelectElaboration: (nodeId: string, text: string, x: number, y: number) => {
            setElaborateAction({ nodeId, text, x, y });
          },
          onOpenPanel: (nodeId: string) => {
            void openContextPanelForNode(nodeId);
          },
          onHoverWheelStart: (nodeId: string) => {
            handleAssistantHoverStart(nodeId);
          },
          onHoverWheelEnd: (nodeId: string) => {
            handleAssistantHoverEnd(nodeId);
          },
          onHoverWheelScroll: (nodeId: string, deltaY: number) => handleAssistantWheel(nodeId, deltaY),
        } as NodeData & {
          onCycleVariant: (nodeId: string, direction: -1 | 1) => void;
          onSelectElaboration: (nodeId: string, text: string, x: number, y: number) => void;
          onOpenPanel: (nodeId: string) => void;
          onHoverWheelStart: (nodeId: string) => void;
          onHoverWheelEnd: (nodeId: string) => void;
          onHoverWheelScroll: (nodeId: string, deltaY: number) => boolean;
        },
      }));

      const collapsedNodes: Node<{ label: string; hiddenCount: number; onUnfold: () => void }>[] = [];
      for (const targetId of collapsedProxyTargets) {
        const node = nodesById.get(targetId);
        if (!node) continue;
        const collapsedId = `${COLLAPSED_NODE_PREFIX}${targetId}`;
        const position = fixedMode ? structure.positions.get(collapsedId) ?? node.position : node.position;
        const hiddenCount = getSubtreeNodeIds(targetId).size;
        collapsedNodes.push({
          id: collapsedId,
          type: "collapsedNode",
          position,
          draggable: false,
          selectable: true,
          hidden: false,
          style: { visibility: "visible", width: COLLAPSED_NODE_SIZE.width, minHeight: COLLAPSED_NODE_SIZE.minHeight },
          data: {
            label: "Folded",
            hiddenCount,
            onUnfold: () => {
              unfoldSubtree(getSubtreeNodeIds(targetId));
            },
          },
        });
      }

      return [...baseNodes, ...collapsedNodes];
    },
    [
      assistantWithBranch,
      collapsedProxyTargets,
      cycleVariant,
      fixedMode,
      getSubtreeNodeIds,
      handleAssistantHoverEnd,
      handleAssistantHoverStart,
      handleAssistantWheel,
      hiddenNodeIds,
      nodes,
      nodesById,
      setPanelOpen,
      setSelectedNode,
      setTranscript,
      structure,
      unfoldSubtree,
      openContextPanelForNode,
    ]
  );

  const uiEdges: Edge[] = useMemo(() => {
    return buildProjectedUiEdges(
      edges,
      hiddenNodeIds,
      collapsedProxyTargets,
      collapsedEdgeSources,
      nodesById,
      COLLAPSED_NODE_PREFIX,
      { type: userEdgeType, motion: userEdgeMotion, lineStyle: userEdgeLineStyle },
      { type: assistantEdgeType, motion: assistantEdgeMotion, lineStyle: assistantEdgeLineStyle }
    );
  }, [
    collapsedEdgeSources,
    collapsedProxyTargets,
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
        {fixedMode && layoutPanelOpen && (
          <div
            className="absolute z-[1000] w-[36rem] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-lg border border-stone-300 bg-paper/95 p-2 backdrop-blur pointer-events-auto"
            style={{ left: layoutPanelPosition.left, top: layoutPanelPosition.top }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">Layout Controls</div>
              <button
                className="rounded bg-stone-200 p-1 text-stone-700 hover:bg-stone-300"
                onClick={() => setLayoutPanelOpen(false)}
                type="button"
                aria-label="Close layout controls"
                title="Close"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 5L15 15M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="mb-2 text-[10px] text-stone-500">Double-click any slider to reset to default.</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-[11px] text-stone-700">
                  Row gap: <span className="font-semibold">{rowGap}</span>
                  <input
                    className="mt-1 w-full"
                    type="range"
                    min={0}
                    max={120}
                    step={1}
                    value={rowGap}
                    onChange={(event) => setRowGap(Number(event.target.value))}
                    onDoubleClick={() => setRowGap(FIXED_ROW_GAP)}
                    title="Double-click to reset"
                  />
                </label>
                <label className="block text-[11px] text-stone-700">
                  Sibling gap: <span className="font-semibold">{siblingGap}</span>
                  <input
                    className="mt-1 w-full"
                    type="range"
                    min={0}
                    max={160}
                    step={1}
                    value={siblingGap}
                    onChange={(event) => setSiblingGap(Number(event.target.value))}
                    onDoubleClick={() => setSiblingGap(FIXED_MIN_COL_GAP)}
                    title="Double-click to reset"
                  />
                </label>
                <label className="block text-[11px] text-stone-700">
                  Fit padding: <span className="font-semibold">{fitViewPadding.toFixed(2)}</span>
                  <input
                    className="mt-1 w-full"
                    type="range"
                    min={0}
                    max={1.2}
                    step={0.02}
                    value={fitViewPadding}
                    onChange={(event) => setFitViewPadding(Number(event.target.value))}
                    onDoubleClick={() => setFitViewPadding(DEFAULT_FIT_VIEW_BUTTON_PADDING)}
                    title="Double-click to reset"
                  />
                </label>
                <label className="block text-[11px] text-stone-700">
                  Wheel hold (s): <span className="font-semibold">{(assistantWheelHoldMs / 1000).toFixed(1)}</span>
                  <input
                    className="mt-1 w-full"
                    type="range"
                    min={0}
                    max={5000}
                    step={100}
                    value={assistantWheelHoldMs}
                    onChange={(event) => setAssistantWheelHoldMs(Number(event.target.value))}
                    onDoubleClick={() => setAssistantWheelHoldMs(DEFAULT_ASSISTANT_WHEEL_HOLD_MS)}
                    title="Double-click to reset"
                  />
                </label>
                <label className="block text-[11px] text-stone-700">
                  Tree gap: <span className="font-semibold">{treeGap}</span>
                  <input
                    className="mt-1 w-full"
                    type="range"
                    min={20}
                    max={420}
                    step={2}
                    value={treeGap}
                    onChange={(event) => setTreeGap(Number(event.target.value))}
                    onDoubleClick={() => setTreeGap(FIXED_TREE_GAP)}
                    title="Double-click to reset"
                  />
                </label>
              </div>
              <div className="space-y-3 text-[11px] text-stone-700">
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wide text-stone-600">User Outgoing Arrows</div>
                <div className="mb-1 text-[10px] text-stone-500">Type</div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {EDGE_TYPE_OPTIONS.map((option) => (
                    <button
                      key={`user-type-${option.value}`}
                      type="button"
                      className={`rounded px-2 py-1 ${
                        userEdgeType === option.value
                          ? "bg-accent/20 text-accent border border-accent/40"
                          : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                      }`}
                      onClick={() => setUserEdgeType(option.value)}
                      title={option.label}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mb-1 text-[10px] text-stone-500">Motion</div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {EDGE_MOTION_OPTIONS.map((option) => (
                    <button
                      key={`user-motion-${option.value}`}
                      type="button"
                      className={`rounded px-2 py-1 ${
                        userEdgeMotion === option.value
                          ? "bg-accent/20 text-accent border border-accent/40"
                          : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                      }`}
                      onClick={() => setUserEdgeMotion(option.value)}
                      title={option.label}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mb-1 text-[10px] text-stone-500">Line Style</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {EDGE_LINE_STYLE_OPTIONS.map((option) => (
                    <button
                      key={`user-line-${option.value}`}
                      type="button"
                      className={`rounded px-2 py-1 ${
                        userEdgeLineStyle === option.value
                          ? "bg-accent/20 text-accent border border-accent/40"
                          : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                      }`}
                      onClick={() => setUserEdgeLineStyle(option.value)}
                      title={option.label}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 font-semibold uppercase tracking-wide text-stone-600">Assistant Outgoing Arrows</div>
                <div className="mb-1 text-[10px] text-stone-500">Type</div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {EDGE_TYPE_OPTIONS.map((option) => (
                    <button
                      key={`assistant-type-${option.value}`}
                      type="button"
                      className={`rounded px-2 py-1 ${
                        assistantEdgeType === option.value
                          ? "bg-accent/20 text-accent border border-accent/40"
                          : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                      }`}
                      onClick={() => setAssistantEdgeType(option.value)}
                      title={option.label}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mb-1 text-[10px] text-stone-500">Motion</div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {EDGE_MOTION_OPTIONS.map((option) => (
                    <button
                      key={`assistant-motion-${option.value}`}
                      type="button"
                      className={`rounded px-2 py-1 ${
                        assistantEdgeMotion === option.value
                          ? "bg-accent/20 text-accent border border-accent/40"
                          : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                      }`}
                      onClick={() => setAssistantEdgeMotion(option.value)}
                      title={option.label}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mb-1 text-[10px] text-stone-500">Line Style</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {EDGE_LINE_STYLE_OPTIONS.map((option) => (
                    <button
                      key={`assistant-line-${option.value}`}
                      type="button"
                      className={`rounded px-2 py-1 ${
                        assistantEdgeLineStyle === option.value
                          ? "bg-accent/20 text-accent border border-accent/40"
                          : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                      }`}
                      onClick={() => setAssistantEdgeLineStyle(option.value)}
                      title={option.label}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
        <div className="h-full w-full">
          <ReactFlow
            nodes={uiNodes}
            edges={uiEdges}
          nodeOrigin={[NODE_ORIGIN_X, NODE_ORIGIN_Y]}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgeClick={(event, edge) => {
              if (!isFoldableEdge(edge, nodesById, hiddenNodeIds)) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              collapseByEdge(edge.target, edge.source);
            }}
            onNodeClick={(_, node) => {
              if (node.id.startsWith(COLLAPSED_NODE_PREFIX)) {
                return;
              }
              setSelectedNode(node.id);
              setNodeContextMenu(null);
            }}
            onNodeContextMenu={(event, node) => {
              if (node.id.startsWith(COLLAPSED_NODE_PREFIX)) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              setSelectedNode(node.id);
              setNodeContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
            }}
            onNodeDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPaneClick={() => {
              setNodeContextMenu(null);
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
            <MiniMap position="top-right" />
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
        onClose={() => setElaborateAction(null)}
      />

      {nodeContextMenu && (
        <div
          ref={nodeContextMenuRef}
          className="fixed z-[1500] min-w-36 rounded-md border border-stone-300 bg-paper/95 p-1 shadow-float backdrop-blur"
          style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="block w-full rounded px-2 py-1 text-left text-xs text-red-700 hover:bg-red-50"
            onClick={() => void handleDeleteNodeSubtree(nodeContextMenu.nodeId)}
            type="button"
          >
            Delete Branch
          </button>
          <button className="mt-1 block w-full rounded px-2 py-1 text-left text-xs text-stone-700 hover:bg-stone-100" type="button">
            Placeholder 2
          </button>
          <button className="mt-1 block w-full rounded px-2 py-1 text-left text-xs text-stone-700 hover:bg-stone-100" type="button">
            Placeholder 3
          </button>
        </div>
      )}

      {wheelHoverNodeId && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-[1400] w-72 -translate-x-1/2 rounded-md border border-stone-300 bg-paper/95 px-3 py-1 shadow-float backdrop-blur">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-700">
            {wheelHoverActive
              ? "Wheel Mode Active"
              : `Hold To Enable Wheel Mode (${(assistantWheelHoldMs / 1000).toFixed(1)}s)`}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className={`h-full rounded-full ${wheelHoverActive ? "bg-accent" : "bg-stone-500"}`}
              style={{ width: `${Math.max(0, Math.min(1, wheelHoverProgress)) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="row-start-3 md:col-start-2 md:row-start-3">
        <ComposerBar
        selectedNodeId={selectedNodeId}
        showFullSelectedNodeId={showFullSelectedNodeId}
        composerText={composerText}
        loading={loading}
        inputRef={composerInputRef}
        onToggleSelectedNodeIdMode={() => setShowFullSelectedNodeId((value) => !value)}
        onComposerTextChange={setComposerText}
        onSend={() => void sendContinue("normal")}
        />
      </div>

      {loading && <div className="pointer-events-none absolute inset-0 z-10 bg-white/20" />}
      {error && <div className="absolute bottom-14 left-3 z-30 rounded bg-red-100 px-3 py-2 text-xs text-red-800">{error}</div>}
    </div>
  );
}
