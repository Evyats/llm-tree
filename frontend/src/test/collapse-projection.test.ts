import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";

import {
  buildChildrenBySource,
  buildLayoutNodes,
  buildProjectedUiEdges,
  collectSubtreeNodeIds,
  isFoldableEdge,
  resolveFoldEdge,
} from "../features/graph/collapseProjection";
import { buildDeleteProjection } from "../features/graph/deleteProjection";
import type { NodeData } from "../store/useGraphStore";

function makeNode(id: string, role: NodeData["role"], parentId: string | null, text: string): Node<NodeData> {
  return {
    id,
    position: { x: 0, y: 0 },
    type: role === "assistant" ? "assistantNode" : "userNode",
    data: {
      role,
      parentId,
      text,
      variants: null,
      variantIndex: 0,
      mode: "normal",
      highlightedText: null,
    },
  };
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target };
}

describe("collapse projection", () => {
  it("keeps edge target id when folded target stays in-place", () => {
    const nodes = [
      makeNode("a1", "assistant", null, "assistant"),
      makeNode("u2", "user", "a1", "child"),
      makeNode("a3", "assistant", "u2", "grandchild"),
    ];
    const edges = [makeEdge("e1", "a1", "u2"), makeEdge("e2", "u2", "a3")];
    const hiddenNodeIds = new Set(["a3"]);
    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    const projected = buildProjectedUiEdges(
      edges,
      hiddenNodeIds,
      nodesById,
      { type: "default", motion: "static", lineStyle: "solid" },
      { type: "default", motion: "static", lineStyle: "solid" }
    );

    const foldedTargetEdge = projected.find((edge) => edge.id === "e1");
    expect(foldedTargetEdge).toBeDefined();
    expect(foldedTargetEdge?.target).toBe("u2");
    expect(projected.some((edge) => edge.id === "e2")).toBe(false);
  });

  it("keeps folded middle sibling in original ordering slot", () => {
    const nodes = [
      makeNode("a0", "assistant", null, "root"),
      makeNode("u1", "user", "a0", "left"),
      makeNode("u2", "user", "a0", "middle"),
      makeNode("u3", "user", "a0", "right"),
    ];
    const edges = [makeEdge("e1", "a0", "u1"), makeEdge("e2", "a0", "u2"), makeEdge("e3", "a0", "u3")];

    const projectedNodes = buildLayoutNodes(
      nodes,
      new Set<string>(),
      ["u2"]
    );
    expect(projectedNodes.map((node) => node.id)).toEqual(["a0", "u1", "u2", "u3"]);
    expect(projectedNodes.find((node) => node.id === "u2")?.type).toBe("collapsedNode");
  });

  it("allows folding on assistant edges and maps user-origin edges to assistant-anchored branch", () => {
    const nodes = [
      makeNode("a0", "assistant", null, "root"),
      makeNode("u1", "user", "a0", "user"),
      makeNode("u1b", "user", "u1", "follow-up user"),
      makeNode("a2", "assistant", "u1", "assistant"),
    ];
    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    expect(isFoldableEdge(makeEdge("e1", "a0", "u1"), nodesById, new Set())).toBe(true);
    expect(isFoldableEdge(makeEdge("e2", "u1", "a2"), nodesById, new Set())).toBe(true);
    expect(isFoldableEdge(makeEdge("e3", "u1b", "a2"), nodesById, new Set())).toBe(true);
    expect(isFoldableEdge(makeEdge("collapsed-edge:x->y", "a0", "u1"), nodesById, new Set())).toBe(false);
    expect(isFoldableEdge(makeEdge("e4", "a0", "u1"), nodesById, new Set(["u1"]))).toBe(false);

    const resolved = resolveFoldEdge(makeEdge("eu", "u1b", "a2"), nodesById, new Set());
    expect(resolved).toEqual({ sourceId: "a0", targetId: "u1" });
  });

  it("folds whole tree from root-user edge when no assistant ancestor exists", () => {
    const nodes = [
      makeNode("u0", "user", null, "root user"),
      makeNode("a1", "assistant", "u0", "assistant"),
      makeNode("u2", "user", "a1", "child"),
    ];
    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    const resolved = resolveFoldEdge(makeEdge("e-root", "u0", "a1"), nodesById, new Set());
    expect(resolved).toEqual({ sourceId: "u0", targetId: "u0" });
    expect(isFoldableEdge(makeEdge("e-root", "u0", "a1"), nodesById, new Set())).toBe(true);
  });
});

describe("delete projection", () => {
  it("produces next graph and allows restoring previous snapshot", () => {
    const nodes = [
      makeNode("a0", "assistant", null, "root"),
      makeNode("u1", "user", "a0", "child"),
      makeNode("a2", "assistant", "u1", "leaf"),
    ];
    const edges = [makeEdge("e1", "a0", "u1"), makeEdge("e2", "u1", "a2")];
    const idsToDelete = collectSubtreeNodeIds("u1", buildChildrenBySource(edges));
    const snapshot = buildDeleteProjection(nodes, edges, idsToDelete);

    expect(snapshot.nextNodes.map((node) => node.id)).toEqual(["a0"]);
    expect(snapshot.nextEdges).toHaveLength(0);
    expect(snapshot.previousNodes.map((node) => node.id)).toEqual(["a0", "u1", "a2"]);
    expect(snapshot.previousEdges.map((edge) => edge.id)).toEqual(["e1", "e2"]);
  });
});
