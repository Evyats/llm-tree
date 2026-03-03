import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  ControlButton,
  Controls,
  MiniMap,
  applyEdgeChanges,
  applyNodeChanges,
  getNodesBounds,
  getViewportForBounds,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import {
  continueFromNode,
  continueInPanel,
  createGraph,
  deleteAllGraphs,
  deleteGraph,
  getGraph,
  listGraphs,
  renameGraph,
  setSessionApiKey,
  updateVariant,
} from "./api/client";
import type { ChatSummary } from "./api/types";
import ElaborateButton from "./components/common/ElaborateButton";
import ContextPanel from "./components/panels/ContextPanel";
import ComposerBar from "./components/panels/ComposerBar";
import PreviousChatsSidebar from "./components/panels/PreviousChatsSidebar";
import AppHeader from "./components/panels/AppHeader";
import AssistantNode from "./components/AssistantNode";
import UserNode from "./components/UserNode";
import { buildTranscriptUntilNode } from "./features/chat/transcript";
import { buildNodeMap, getAssistantNodesWithUserBranch, getContinueFromVariantIndex } from "./features/graph/nodeSelectors";
import {
  FIT_VIEW_OPTIONS,
  FIXED_MIN_COL_GAP,
  FIXED_ROW_GAP,
  FIXED_TREE_GAP,
  GRAPH_STORAGE_KEY,
} from "./features/layout/constants";
import { buildFixedPositions } from "./features/layout/layoutEngine";
import { useGraphStore, type NodeData } from "./store/useGraphStore";

interface ElaborateAction {
  nodeId: string;
  text: string;
  x: number;
  y: number;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 2.5;
const CONTEXT_PANEL_WIDTH = 420;
const FOOTER_OVERLAY_HEIGHT = 52;
const FIT_VIEW_BUTTON_PADDING = 0.4;
const ZOOM_BUTTON_FACTOR = 1.4;
const DEFAULT_ASSISTANT_WHEEL_HOLD_MS = 100;
const ASSISTANT_WHEEL_STEP_COOLDOWN_MS = 140;
const DEFAULT_EDGE_STYLE = "default";
const EDGE_STYLE_OPTIONS = [
  { value: "default", label: "Bezier" },
  { value: "straight", label: "Straight" },
  { value: "step", label: "Step" },
] as const;

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
  const [previousChats, setPreviousChats] = useState<ChatSummary[]>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [fixedMode, setFixedMode] = useState(true);
  const [nodeSizes, setNodeSizes] = useState<Map<string, { width: number; height: number }>>(new Map());
  const [rowGap, setRowGap] = useState(FIXED_ROW_GAP);
  const [treeGap, setTreeGap] = useState(FIXED_TREE_GAP);
  const [siblingGap, setSiblingGap] = useState(FIXED_MIN_COL_GAP);
  const [assistantWheelHoldMs, setAssistantWheelHoldMs] = useState(DEFAULT_ASSISTANT_WHEEL_HOLD_MS);
  const [edgeStyleIndex, setEdgeStyleIndex] = useState(0);
  const [layoutPanelOpen, setLayoutPanelOpen] = useState(false);
  const [layoutPanelPosition, setLayoutPanelPosition] = useState({ left: 120, top: 56 });
  const [wheelHoverNodeId, setWheelHoverNodeId] = useState<string | null>(null);
  const [wheelHoverProgress, setWheelHoverProgress] = useState(0);
  const [wheelHoverActive, setWheelHoverActive] = useState(false);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const manualPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const nodesRef = useRef(nodes);
  const wheelHoverStartRef = useRef<number>(0);
  const wheelHoverRafRef = useRef<number | null>(null);
  const wheelLastStepAtRef = useRef(0);

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
  }, [graphId]);

  useEffect(() => {
    for (const node of nodes) {
      if (!manualPositionsRef.current.has(node.id)) {
        manualPositionsRef.current.set(node.id, { ...node.position });
      }
    }
  }, [nodes]);

  const fitCanvasToGraph = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!reactFlowInstance || !mainRef.current) return;
        const rfNodes = reactFlowInstance.getNodes().filter((node) => !node.hidden);
        if (rfNodes.length === 0) return;

        const bounds = getNodesBounds(rfNodes);
        const visibleWidth = Math.max(120, mainRef.current.clientWidth - (panelOpen ? CONTEXT_PANEL_WIDTH : 0));
        const visibleHeight = Math.max(120, mainRef.current.clientHeight - FOOTER_OVERLAY_HEIGHT);
        const viewport = getViewportForBounds(
          bounds,
          visibleWidth,
          visibleHeight,
          MIN_ZOOM,
          MAX_ZOOM,
          FIT_VIEW_BUTTON_PADDING
        );
        void reactFlowInstance.setViewport(viewport, { duration: FIT_VIEW_OPTIONS.duration ?? 280 });
      });
    });
  }, [panelOpen, reactFlowInstance]);

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

  const refreshGraphList = useCallback(async () => {
    try {
      const items = await listGraphs();
      setPreviousChats(items);
    } catch {
      // Non-blocking panel data.
    }
  }, []);

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
  }, [fitCanvasToGraph, refreshGraphList, setGraph]);

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
      if (wheelHoverRafRef.current !== null) {
        cancelAnimationFrame(wheelHoverRafRef.current);
        wheelHoverRafRef.current = null;
      }
      setWheelHoverNodeId(nodeId);
      setWheelHoverProgress(0);
      setWheelHoverActive(false);
      wheelHoverStartRef.current = performance.now();
      wheelLastStepAtRef.current = 0;
      // Render immediate 0% state before first animation frame.
      setWheelHoverProgress(0.001);

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

  const sendContinue = useCallback(
    async (mode: "normal" | "elaboration", highlightedText?: string) => {
      if (!graphId) return;
      const userText = mode === "elaboration" ? "Elaborate on this specific point." : composerText.trim();
      if (!userText) {
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const response = await continueFromNode({
          graph_id: graphId,
          continue_from_node_id: selectedNodeId,
          continue_from_variant_index: getContinueFromVariantIndex(nodesById, selectedNodeId),
          user_text: userText,
          mode,
          highlighted_text: highlightedText ?? null,
        });
        appendEntities([response.created_user_node, response.created_assistant_node], response.created_edges);
        setSelectedNode(response.created_assistant_node.id);
        setTranscript(response.transcript_window);
        setResponseSource(response.response_source);
        setComposerText("");
        setElaborateAction(null);
        await refreshGraphList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setLoading(false);
      }
    },
    [appendEntities, composerText, graphId, nodesById, refreshGraphList, selectedNodeId, setResponseSource, setSelectedNode, setTranscript]
  );

  const sendPanelContinue = useCallback(async () => {
    if (!graphId || !selectedNodeId || !panelText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await continueInPanel({
        graph_id: graphId,
        anchor_node_id: selectedNodeId,
        anchor_variant_index: getContinueFromVariantIndex(nodesById, selectedNodeId),
        user_text: panelText.trim(),
      });
      appendEntities([response.created_user_node, response.created_assistant_node], response.created_edges);
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
  }, [appendEntities, graphId, nodesById, panelText, refreshGraphList, selectedNodeId, setResponseSource, setSelectedNode, setTranscript]);

  const loadGraph = useCallback(
    async (targetGraphId: string) => {
      const graph = await getGraph(targetGraphId);
      localStorage.setItem(GRAPH_STORAGE_KEY, targetGraphId);
      setGraph(graph.graph_id, graph.title, graph.nodes, graph.edges);
      fitCanvasToGraph();
      setPanelOpen(false);
      setError(null);
    },
    [fitCanvasToGraph, setGraph, setPanelOpen]
  );

  const startNewChat = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const created = await createGraph("Chat Tree");
      localStorage.setItem(GRAPH_STORAGE_KEY, created.graph_id);
      const graph = await getGraph(created.graph_id);
      setGraph(graph.graph_id, graph.title, graph.nodes, graph.edges);
      fitCanvasToGraph();
      setComposerText("");
      setPanelText("");
      setPanelOpen(false);
      setElaborateAction(null);
      setResponseSource(null);
      setTranscript([]);
      await refreshGraphList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start new chat");
    } finally {
      setLoading(false);
    }
  }, [fitCanvasToGraph, refreshGraphList, setGraph, setPanelOpen, setResponseSource, setTranscript]);

  const selectChatFromHistory = useCallback(
    async (targetGraphId: string) => {
      if (targetGraphId === graphId) {
        setPanelOpen(false);
        return;
      }
      try {
        setLoading(true);
        await loadGraph(targetGraphId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chat");
      } finally {
        setLoading(false);
      }
    },
    [graphId, loadGraph, setPanelOpen]
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
    [graphId, loadGraph, refreshGraphList]
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
    [graphId, loadGraph, previousChats, refreshGraphList]
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
  }, [loadGraph, refreshGraphList]);

  const nodeTypes = useMemo(
    () => ({
      userNode: UserNode,
      assistantNode: AssistantNode,
    }),
    []
  );

  const structure = useMemo(
    () => buildFixedPositions(nodes, nodeSizes, { rowGap, treeGap, siblingGap }),
    [nodes, nodeSizes, rowGap, treeGap, siblingGap]
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

  const uiNodes: Node<NodeData>[] = useMemo(
    () =>
      nodes.map((node) => ({
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
            setSelectedNode(nodeId);
            setPanelOpen(true);
            setTranscript(buildTranscriptUntilNode(nodes, nodeId));
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
      })),
    [
      assistantWithBranch,
      cycleVariant,
      fixedMode,
      handleAssistantHoverEnd,
      handleAssistantHoverStart,
      handleAssistantWheel,
      nodes,
      setPanelOpen,
      setSelectedNode,
      setTranscript,
      structure,
    ]
  );

  const uiEdges: Edge[] = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        type: fixedMode ? EDGE_STYLE_OPTIONS[edgeStyleIndex]?.value ?? DEFAULT_EDGE_STYLE : DEFAULT_EDGE_STYLE,
      })),
    [edgeStyleIndex, edges, fixedMode]
  );

  return (
    <div className={`relative h-full w-full overflow-hidden ${fixedMode ? "fixed-layout-animated" : ""}`}>
      <PreviousChatsSidebar
        graphId={graphId}
        chats={previousChats}
        onSelect={(targetGraphId) => void selectChatFromHistory(targetGraphId)}
        onRename={(chat) => void handleRenameChat(chat)}
        onDelete={(chat) => void handleDeleteChat(chat)}
        onDeleteAll={() => void handleDeleteAllChats()}
      />

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
      />

      {wheelHoverNodeId && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-[1100] w-72 -translate-x-1/2 rounded-lg border border-stone-300 bg-paper/95 px-3 py-2 shadow-float backdrop-blur">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-700">
            {wheelHoverActive
              ? "Wheel Mode Active"
              : `Hold To Enable Wheel Mode (${(assistantWheelHoldMs / 1000).toFixed(1)}s)`}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className={`h-full rounded-full ${
                wheelHoverActive ? "bg-accent" : "bg-stone-500"
              }`}
              style={{ width: `${wheelHoverProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      <main ref={mainRef} className="h-full pl-64 pt-12">
        {fixedMode && layoutPanelOpen && (
          <div
            className="absolute z-[1000] w-64 rounded-lg border border-stone-300 bg-paper/95 p-2 backdrop-blur pointer-events-auto"
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
            <label className="mb-2 block text-[11px] text-stone-700">
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
            <label className="mb-2 block text-[11px] text-stone-700">
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
            <label className="mb-2 block text-[11px] text-stone-700">
              Wheel hold (s): <span className="font-semibold">{(assistantWheelHoldMs / 1000).toFixed(1)}</span>
              <input
                className="mt-1 w-full"
                type="range"
                min={100}
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
            <div className="mt-2 text-[11px] text-stone-700">
              <div className="mb-1">
                Edge style: <span className="font-semibold">{EDGE_STYLE_OPTIONS[edgeStyleIndex]?.label}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {EDGE_STYLE_OPTIONS.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded px-2 py-1 ${
                      edgeStyleIndex === index
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                    }`}
                    onClick={() => setEdgeStyleIndex(index)}
                    aria-label={`Set edge style to ${option.label}`}
                    title={option.label}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={uiNodes}
          edges={uiEdges}
          nodeOrigin={[0.5, 0]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => setSelectedNode(node.id)}
          onNodeDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onPaneClick={() => setSelectedNode(null)}
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
              onClick={() => {
                if (!reactFlowInstance) return;
                const viewport = reactFlowInstance.getViewport();
                const nextZoom = Math.min(MAX_ZOOM, viewport.zoom * ZOOM_BUTTON_FACTOR);
                void reactFlowInstance.setViewport({ ...viewport, zoom: nextZoom }, { duration: 220 });
              }}
              title="Zoom in"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 5v10M5 10h10" strokeLinecap="round" />
              </svg>
            </ControlButton>
            <ControlButton
              onClick={() => {
                if (!reactFlowInstance) return;
                const viewport = reactFlowInstance.getViewport();
                const nextZoom = Math.max(MIN_ZOOM, viewport.zoom / ZOOM_BUTTON_FACTOR);
                void reactFlowInstance.setViewport({ ...viewport, zoom: nextZoom }, { duration: 220 });
              }}
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
              {fixedMode ? (
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6.5 9V6.8a3.5 3.5 0 1 1 7 0V9" strokeLinecap="round" />
                  <rect x="5" y="9" width="10" height="7" rx="1.2" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6.5 9V6.8a3.5 3.5 0 1 1 7 0V9" strokeLinecap="round" />
                  <rect x="5" y="9" width="10" height="7" rx="1.2" />
                  <path d="M12.8 4.2l3.2 3.2" strokeLinecap="round" />
                </svg>
              )}
            </ControlButton>
          </Controls>
        </ReactFlow>
      </main>

      <ElaborateButton
        action={elaborateAction}
        onClick={(action) => {
          setSelectedNode(action.nodeId);
          void sendContinue("elaboration", action.text);
        }}
      />

      <ContextPanel
        open={panelOpen}
        transcript={transcript}
        panelText={panelText}
        onClose={() => setPanelOpen(false)}
        onPanelTextChange={setPanelText}
        onSend={() => void sendPanelContinue()}
      />

      <ComposerBar
        selectedNodeId={selectedNodeId}
        composerText={composerText}
        loading={loading}
        inputRef={composerInputRef}
        onComposerTextChange={setComposerText}
        onSend={() => void sendContinue("normal")}
      />

      {loading && <div className="pointer-events-none absolute inset-0 z-10 bg-white/20" />}
      {error && <div className="absolute bottom-14 left-3 z-30 rounded bg-red-100 px-3 py-2 text-xs text-red-800">{error}</div>}
    </div>
  );
}
