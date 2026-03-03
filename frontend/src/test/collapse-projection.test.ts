import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";

import {
  buildChildrenBySource,
  buildLayoutNodes,
  buildProjectedUiEdges,
  collectSubtreeNodeIds,
  isFoldableEdge,
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
  it("projects folded edge to collapsed node id", () => {
    const nodes = [
      makeNode("a1", "assistant", null, "assistant"),
      makeNode("u2", "user", "a1", "child"),
      makeNode("a3", "assistant", "u2", "grandchild"),
    ];
    const edges = [makeEdge("e1", "a1", "u2"), makeEdge("e2", "u2", "a3")];
    const hiddenNodeIds = new Set(["u2", "a3"]);
    const collapsedProxyTargets = ["u2"];
    const collapsedEdgeSources = new Map<string, string>([["u2", "a1"]]);
    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    const projected = buildProjectedUiEdges(
      edges,
      hiddenNodeIds,
      collapsedProxyTargets,
      collapsedEdgeSources,
      nodesById,
      "collapsed__",
      { type: "default", motion: "static", lineStyle: "solid" },
      { type: "default", motion: "static", lineStyle: "solid" }
    );

    const collapsedEdge = projected.find((edge) => edge.id === "collapsed-edge:a1->u2");
    expect(collapsedEdge).toBeDefined();
    expect(collapsedEdge?.target).toBe("collapsed__u2");
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
      edges,
      new Set(["u2"]),
      ["u2"],
      new Map([["u2", "a0"]]),
      "collapsed__"
    );
    expect(projectedNodes.map((node) => node.id)).toEqual(["a0", "u1", "collapsed__u2", "u3"]);
  });

  it("allows folding only on assistant-outgoing non-collapsed visible edges", () => {
    const nodes = [
      makeNode("a0", "assistant", null, "root"),
      makeNode("u1", "user", "a0", "user"),
      makeNode("a2", "assistant", "u1", "assistant"),
    ];
    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    expect(isFoldableEdge(makeEdge("e1", "a0", "u1"), nodesById, new Set())).toBe(true);
    expect(isFoldableEdge(makeEdge("e2", "u1", "a2"), nodesById, new Set())).toBe(false);
    expect(isFoldableEdge(makeEdge("collapsed-edge:x->y", "a0", "u1"), nodesById, new Set())).toBe(false);
    expect(isFoldableEdge(makeEdge("e3", "a0", "u1"), nodesById, new Set(["u1"]))).toBe(false);
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
