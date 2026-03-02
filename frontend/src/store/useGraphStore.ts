import { create } from "zustand";
import { MarkerType, type Edge, type Node } from "reactflow";

import type { GraphEdgePayload, GraphNodePayload } from "../types/graph";

export interface NodeData {
  role: "user" | "assistant";
  parentId: string | null;
  text: string;
  variants: { short: string; medium: string; long: string } | null;
  variantIndex: number;
  mode: string;
  highlightedText: string | null;
}

interface GraphState {
  graphId: string | null;
  title: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  panelOpen: boolean;
  transcript: Array<{ role: string; content: string }>;
  responseSource: "live" | "fallback" | null;
  setGraph: (
    graphId: string,
    title: string,
    nodes: GraphNodePayload[],
    edges: GraphEdgePayload[]
  ) => void;
  appendEntities: (nodes: GraphNodePayload[], edges: GraphEdgePayload[]) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodeVariant: (nodeId: string, variantIndex: number) => void;
  setPanelOpen: (open: boolean) => void;
  setTranscript: (transcript: Array<{ role: string; content: string }>) => void;
  setResponseSource: (source: "live" | "fallback" | null) => void;
}

function nodePayloadToFlowNode(node: GraphNodePayload): Node<NodeData> {
  return {
    id: node.id,
    type: node.role === "assistant" ? "assistantNode" : "userNode",
    position: { x: node.position_x, y: node.position_y },
    data: {
      role: node.role,
      parentId: node.parent_id,
      text: node.text,
      variants: node.variants,
      variantIndex: node.variant_index,
      mode: node.mode,
      highlightedText: node.highlighted_text,
    },
  };
}

function edgePayloadToFlowEdge(edge: GraphEdgePayload): Edge {
  return {
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    type: "straight",
    animated: edge.edge_type === "reply",
    style: { strokeWidth: 2 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#176b87",
    },
  };
}

export const useGraphStore = create<GraphState>((set) => ({
  graphId: null,
  title: "Chat Tree",
  nodes: [],
  edges: [],
  selectedNodeId: null,
  panelOpen: false,
  transcript: [],
  responseSource: null,
  setGraph: (graphId, title, nodes, edges) =>
    set({
      graphId,
      title,
      nodes: nodes.map(nodePayloadToFlowNode),
      edges: edges.map(edgePayloadToFlowEdge),
      selectedNodeId: null,
      transcript: [],
    }),
  appendEntities: (nodes, edges) =>
    set((state) => ({
      nodes: [...state.nodes, ...nodes.map(nodePayloadToFlowNode)],
      edges: [...state.edges, ...edges.map(edgePayloadToFlowEdge)],
    })),
  setSelectedNode: (selectedNodeId) => set({ selectedNodeId }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  updateNodeVariant: (nodeId, variantIndex) =>
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id !== nodeId || !node.data.variants) {
          return node;
        }
        const variants = [node.data.variants.short, node.data.variants.medium, node.data.variants.long];
        return {
          ...node,
          data: {
            ...node.data,
            variantIndex,
            text: variants[variantIndex] ?? variants[1],
          },
        };
      }),
    })),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setTranscript: (transcript) => set({ transcript }),
  setResponseSource: (responseSource) => set({ responseSource }),
}));
