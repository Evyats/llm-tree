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
import { FIT_VIEW_OPTIONS, GRAPH_STORAGE_KEY } from "./features/layout/constants";
import { buildFixedPositions } from "./features/layout/layoutEngine";
import { useGraphStore, type NodeData } from "./store/useGraphStore";

interface ElaborateAction {
  nodeId: string;
  text: string;
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
  const [fixedMode, setFixedMode] = useState(false);
  const [nodeSizes, setNodeSizes] = useState<Map<string, { width: number; height: number }>>(new Map());
  const composerInputRef = useRef<HTMLInputElement>(null);

  const manualPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const nodesRef = useRef(nodes);

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
        reactFlowInstance?.fitView(FIT_VIEW_OPTIONS);
      });
    });
  }, [reactFlowInstance]);

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

  const structure = useMemo(() => buildFixedPositions(nodes, nodeSizes), [nodes, nodeSizes]);

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
    if (fixedMode) {
      fitCanvasToGraph();
    }
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

  const assistantWithBranch = useMemo(() => getAssistantNodesWithUserBranch(nodesById, edges), [edges, nodesById]);

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
        } as NodeData & {
          onCycleVariant: (nodeId: string, direction: -1 | 1) => void;
          onSelectElaboration: (nodeId: string, text: string, x: number, y: number) => void;
          onOpenPanel: (nodeId: string) => void;
        },
      })),
    [assistantWithBranch, cycleVariant, fixedMode, nodes, setPanelOpen, setSelectedNode, setTranscript, structure]
  );

  const uiEdges: Edge[] = edges;

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

      <main className="h-full pl-64 pt-12">
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
          minZoom={0.05}
          maxZoom={2.5}
          nodesDraggable={!fixedMode}
          panOnDrag
          zoomOnScroll
          zoomOnDoubleClick={!fixedMode}
        >
          <Background color="#d6d0c5" gap={18} />
          <MiniMap position="top-right" />
          <Controls position="top-left" fitViewOptions={FIT_VIEW_OPTIONS}>
            <ControlButton onClick={toggleLayoutMode} title={fixedMode ? "Switch to Free Layout" : "Switch to Fixed Layout"}>
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
