import { create } from "zustand";
import type { Edge, Node } from "reactflow";

import type { TranscriptLine } from "../features/chat/types";
import type { GraphEdgePayload, GraphNodePayload } from "../types/graph";
import { edgePayloadToFlowEdge, nodePayloadToFlowNode } from "./mappers";

export interface NodeData {
  role: "user" | "assistant";
  parentId: string | null;
  text: string;
  variants: { short: string; medium: string; long: string } | null;
  variantIndex: number;
  pending?: boolean;
  compacting?: boolean;
  variantLocked?: boolean;
  layer?: number;
  siblingOrder?: number;
  mode: string;
  highlightedText: string | null;
  elaboratedSelections?: Array<string | { text: string; occurrence: number }>;
  sizingSignature?: string;
}

interface GraphState {
  graphId: string | null;
  title: string;
  titleState: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  panelOpen: boolean;
  transcript: TranscriptLine[];
  responseSource: "live" | "fallback" | null;
  setGraph: (graphId: string, title: string, titleState: string, nodes: GraphNodePayload[], edges: GraphEdgePayload[]) => void;
  setTitle: (title: string, titleState?: string) => void;
  appendEntities: (nodes: GraphNodePayload[], edges: GraphEdgePayload[]) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodeVariant: (nodeId: string, variantIndex: number) => void;
  lockNodeVariant: (nodeId: string) => void;
  setPanelOpen: (open: boolean) => void;
  setTranscript: (transcript: TranscriptLine[]) => void;
  setResponseSource: (source: "live" | "fallback" | null) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  graphId: null,
  title: "Chat Tree",
  titleState: "untitled",
  nodes: [],
  edges: [],
  selectedNodeId: null,
  panelOpen: false,
  transcript: [],
  responseSource: null,
  setGraph: (graphId, title, titleState, nodes, edges) =>
    set({
      graphId,
      title,
      titleState,
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
  setTitle: (title, titleState) => set((state) => ({ title, titleState: titleState ?? state.titleState })),
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
  lockNodeVariant: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                variants: null,
                variantIndex: 0,
                variantLocked: true,
              },
            }
          : node
      ),
    })),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setTranscript: (transcript) => set({ transcript }),
  setResponseSource: (responseSource) => set({ responseSource }),
}));
