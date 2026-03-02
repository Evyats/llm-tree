import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type FitViewOptions,
  type ReactFlowInstance,
  type Edge,
  type Node,
  type NodeChange,
  applyNodeChanges,
  type EdgeChange,
  applyEdgeChanges,
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
import AssistantNode from "./components/AssistantNode";
import UserNode from "./components/UserNode";
import { useGraphStore, type NodeData } from "./store/useGraphStore";

interface ElaborateAction {
  nodeId: string;
  text: string;
  x: number;
  y: number;
}

const GRAPH_STORAGE_KEY = "chat-tree:last-graph-id";
const FIT_VIEW_OPTIONS: FitViewOptions = {
  padding: 0.34,
  duration: 280,
  includeHiddenNodes: true,
};

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
  const [previousChats, setPreviousChats] = useState<Array<{ graph_id: string; title: string; updated_at: string }>>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const fitCanvasToGraph = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        reactFlowInstance?.fitView(FIT_VIEW_OPTIONS);
      });
    });
  };

  const refreshGraphList = async () => {
    try {
      const items = await listGraphs();
      setPreviousChats(items);
    } catch {
      // Non-blocking panel data.
    }
  };

  const buildTranscriptUntilNode = (targetNodeId: string) => {
    const index = new Map(nodes.map((node) => [node.id, node]));
    const chain: Node<NodeData>[] = [];
    let current = index.get(targetNodeId) ?? null;
    while (current) {
      chain.push(current);
      const parentId = current.data.parentId;
      current = parentId ? index.get(parentId) ?? null : null;
    }
    chain.reverse();
    return chain.map((node) => ({
      role: node.data.role,
      content: node.data.text,
    }));
  };

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
  }, [setGraph]);

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes(applyNodeChanges(changes, nodes));
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges(applyEdgeChanges(changes, edges));
  };

  const cycleVariant = async (nodeId: string, direction: -1 | 1) => {
    const node = nodes.find((item) => item.id === nodeId);
    const current = node?.data.variantIndex ?? 0;
    const next = (current + direction + 3) % 3;
    updateVariantLocal(nodeId, next);
    try {
      await updateVariant(nodeId, next);
    } catch {
      // Keep UI optimistic even if persistence update fails.
    }
  };

  const sendContinue = async (mode: "normal" | "elaboration", highlightedText?: string) => {
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
  };

  const sendPanelContinue = async () => {
    if (!graphId || !selectedNodeId || !panelText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await continueInPanel({
        graph_id: graphId,
        anchor_node_id: selectedNodeId,
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
  };

  const startNewChat = async () => {
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
  };

  const loadGraph = async (targetGraphId: string) => {
    const graph = await getGraph(targetGraphId);
    localStorage.setItem(GRAPH_STORAGE_KEY, targetGraphId);
    setGraph(graph.graph_id, graph.title, graph.nodes, graph.edges);
    fitCanvasToGraph();
    setPanelOpen(false);
    setError(null);
  };

  const selectChatFromHistory = async (targetGraphId: string) => {
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
  };

  const nodeTypes = useMemo(
    () => ({
      userNode: UserNode,
      assistantNode: AssistantNode,
    }),
    []
  );

  const uiNodes: Node<NodeData>[] = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onCycleVariant: cycleVariant,
          onSelectElaboration: (nodeId: string, text: string, x: number, y: number) => {
            setElaborateAction({ nodeId, text, x, y });
          },
          onOpenPanel: (nodeId: string) => {
            setSelectedNode(nodeId);
            setPanelOpen(true);
            setTranscript(buildTranscriptUntilNode(nodeId));
          },
        } as NodeData & {
          onCycleVariant: (nodeId: string, direction: -1 | 1) => void;
          onSelectElaboration: (nodeId: string, text: string, x: number, y: number) => void;
          onOpenPanel: (nodeId: string) => void;
        },
      })),
    [nodes, setPanelOpen, setSelectedNode]
  );

  const uiEdges: Edge[] = edges;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <aside className="absolute bottom-12 left-0 top-12 z-30 flex w-64 flex-col border-r border-stone-300 bg-paper/92 p-2 backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-600">Previous Chats</div>
          <button
            className="rounded bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-200"
            onClick={async () => {
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
            }}
            type="button"
          >
            Remove All
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {previousChats.length === 0 ? (
            <div className="rounded border border-stone-200 bg-white px-2 py-2 text-xs text-stone-500">No saved chats yet.</div>
          ) : (
            previousChats.map((chat) => (
              <div
                key={chat.graph_id}
                className={`w-full cursor-pointer rounded border px-2 py-2 text-left text-xs ${
                  graphId === chat.graph_id ? "border-accent bg-accent/10" : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
                onClick={() => void selectChatFromHistory(chat.graph_id)}
              >
                <div className="truncate font-medium">{chat.title || "Untitled Chat"}</div>
                <div className="mt-1 truncate text-[10px] text-stone-500">{new Date(chat.updated_at).toLocaleString()}</div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="rounded bg-stone-200 px-2 py-1 text-[10px] text-stone-700 hover:bg-stone-300"
                    onClick={async (event) => {
                      event.stopPropagation();
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
                    }}
                    type="button"
                    aria-label="Rename chat"
                    title="Rename chat"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 13.5V16h2.5L14.9 7.6l-2.5-2.5L4 13.5Z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M11.8 5.2l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    className="rounded bg-red-100 px-2 py-1 text-[10px] text-red-700 hover:bg-red-200"
                    onClick={async (event) => {
                      event.stopPropagation();
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
                    }}
                    type="button"
                    aria-label="Remove chat"
                    title="Remove chat"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4.5 6h11" strokeLinecap="round" />
                      <path d="M7.5 6V4.8c0-.44.36-.8.8-.8h3.4c.44 0 .8.36.8.8V6" strokeLinecap="round" />
                      <path d="M6.8 6l.7 9.1c.04.49.44.87.93.87h3.2c.49 0 .89-.38.93-.87L13.2 6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <header className="absolute left-0 top-0 z-20 flex w-full items-center justify-between gap-3 border-b border-stone-300 bg-paper/85 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{title}</h1>
          {responseSource && (
            <span className="rounded bg-stone-100 px-2 py-1 text-xs">
              source: {responseSource}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded bg-stone-800 px-3 py-1 text-xs text-white"
            onClick={() => void startNewChat()}
            type="button"
          >
            New Chat
          </button>
          <input
            className="w-64 rounded border border-stone-300 px-2 py-1 text-xs"
            placeholder="Optional session OpenAI key"
            type="password"
            value={apiKeyInput}
            onChange={(event) => setApiKeyInput(event.target.value)}
          />
          <button
            className="rounded bg-accent px-3 py-1 text-xs text-white"
            onClick={async () => {
              if (!apiKeyInput.trim()) return;
              await setSessionApiKey(apiKeyInput.trim());
              setApiKeyInput("");
            }}
            type="button"
          >
            Save Key
          </button>
        </div>
      </header>

      <main className="h-full pl-64 pt-12">
        <ReactFlow
          nodes={uiNodes}
          edges={uiEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => setSelectedNode(node.id)}
          onPaneClick={() => setSelectedNode(null)}
          onInit={setReactFlowInstance}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          minZoom={0.05}
          maxZoom={2.5}
          panOnDrag
          zoomOnScroll
        >
          <Background color="#d6d0c5" gap={18} />
          <MiniMap position="top-right" />
          <Controls position="top-left" fitViewOptions={FIT_VIEW_OPTIONS} />
        </ReactFlow>
      </main>

      {elaborateAction && (
        <button
          className="fixed z-30 rounded bg-warm px-3 py-1 text-xs text-white shadow-float"
          style={{ left: elaborateAction.x, top: elaborateAction.y }}
          onClick={() => {
            setSelectedNode(elaborateAction.nodeId);
            void sendContinue("elaboration", elaborateAction.text);
          }}
          type="button"
        >
          Elaborate
        </button>
      )}

      {panelOpen && (
        <aside className="absolute right-0 top-12 z-20 h-[calc(100%-6.5rem)] w-[420px] border-l border-stone-300 bg-paper/95 p-3 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Context Chat</h2>
            <button className="rounded bg-stone-200 px-2 py-1 text-xs" onClick={() => setPanelOpen(false)} type="button">
              Close
            </button>
          </div>
          <div className="mb-3 h-[calc(100%-5rem)] overflow-auto rounded border border-stone-300 bg-white p-2">
            {transcript.length === 0 ? (
              <p className="text-xs text-stone-500">Select a node and continue to populate context.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {transcript.map((line, index) => (
                  <div
                    key={`${line.role}-${index}`}
                    className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        line.role === "user"
                          ? "rounded-br-md bg-accent text-white"
                          : "rounded-bl-md border border-stone-200 bg-stone-50 text-ink"
                      }`}
                    >
                      <div
                        className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${
                          line.role === "user" ? "text-blue-100" : "text-stone-500"
                        }`}
                      >
                        {line.role}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{line.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm"
              value={panelText}
              onChange={(event) => setPanelText(event.target.value)}
              placeholder="Continue from selected node..."
            />
            <button className="rounded bg-accent px-3 py-1 text-sm text-white" onClick={() => void sendPanelContinue()} type="button">
              Send
            </button>
          </div>
        </aside>
      )}

      <footer className="absolute bottom-0 left-0 z-20 flex w-full items-center gap-2 border-t border-stone-300 bg-paper/90 px-3 py-2 pl-[16.6rem] backdrop-blur">
        <div className="rounded bg-stone-100 px-2 py-1 text-xs">
          selected: {selectedNodeId ?? "none"}
        </div>
        <input
          className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
          placeholder="Write a message for the selected node branch..."
          value={composerText}
          onChange={(event) => setComposerText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendContinue("normal");
            }
          }}
        />
        <button className="rounded bg-accent px-4 py-2 text-sm text-white" onClick={() => void sendContinue("normal")} disabled={loading} type="button">
          {loading ? "..." : "Send"}
        </button>
      </footer>

      {loading && <div className="pointer-events-none absolute inset-0 z-10 bg-white/20" />}
      {error && (
        <div className="absolute bottom-14 left-3 z-30 rounded bg-red-100 px-3 py-2 text-xs text-red-800">{error}</div>
      )}
    </div>
  );
}
