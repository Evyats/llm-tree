import { describe, expect, it } from "vitest";
import type { Node } from "reactflow";

import { buildFixedPositions } from "../features/layout/layoutEngine";
import type { NodeData } from "../store/useGraphStore";

function makeNode(id: string, role: NodeData["role"], parentId: string | null, text: string): Node<NodeData> {
  return {
    id,
    type: role === "assistant" ? "assistantNode" : "userNode",
    position: { x: 0, y: 0 },
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

describe("layoutEngine", () => {
  it("places two consecutive user nodes at 1 and 1.5 before assistant row 2", () => {
    const nodes = [
      makeNode("a0", "assistant", null, "anchor"),
      makeNode("u1", "user", "a0", "first"),
      makeNode("u2", "user", "u1", "second"),
      makeNode("a3", "assistant", "u2", "answer 2"),
    ];

    const result = buildFixedPositions(nodes, new Map());
    expect(result.meta.get("a0")?.layer).toBe(0);
    expect(result.meta.get("u1")?.layer).toBe(1);
    expect(result.meta.get("u2")?.layer).toBe(1.5);
    expect(result.meta.get("a3")?.layer).toBe(2);
  });

  it("separates sibling nodes horizontally to avoid overlap", () => {
    const nodes = [
      makeNode("u0", "user", null, "root"),
      makeNode("a1", "assistant", "u0", "first child"),
      makeNode("a2", "assistant", "u0", "second child"),
    ];

    const sizes = new Map([
      ["a1", { width: 300, height: 120 }],
      ["a2", { width: 300, height: 120 }],
    ]);

    const result = buildFixedPositions(nodes, sizes);
    const x1 = result.positions.get("a1")?.x ?? 0;
    const x2 = result.positions.get("a2")?.x ?? 0;
    expect(x2 - x1).toBeGreaterThan(280);
  });

  it("top-aligns nodes that share a layer even with different heights", () => {
    const nodes = [
      makeNode("u0", "user", null, "root"),
      makeNode("a1", "assistant", "u0", "short"),
      makeNode("u2", "user", "u0", "branch"),
      makeNode("a3", "assistant", "u2", "very long assistant text that should create a much taller card"),
    ];

    const sizes = new Map([
      ["a1", { width: 300, height: 130 }],
      ["a3", { width: 500, height: 260 }],
    ]);

    const result = buildFixedPositions(nodes, sizes);
    const y1 = result.positions.get("a1")?.y;
    const y3 = result.positions.get("a3")?.y;
    expect(y1).toBeDefined();
    expect(y3).toBeDefined();
    expect(y1).toBe(y3);
  });

  it("evenly distributes consecutive user nodes before the next assistant row", () => {
    const nodes = [
      makeNode("a0", "assistant", null, "anchor"),
      makeNode("u1", "user", "a0", "first"),
      makeNode("u2", "user", "u1", "second"),
      makeNode("u3", "user", "u2", "third"),
      makeNode("a4", "assistant", "u3", "final response"),
    ];

    const result = buildFixedPositions(nodes, new Map());
    expect(result.meta.get("u1")?.layer).toBeCloseTo(1, 3);
    expect(result.meta.get("u2")?.layer).toBeCloseTo(1.333, 3);
    expect(result.meta.get("u3")?.layer).toBeCloseTo(1.667, 3);
    expect(result.meta.get("a4")?.layer).toBe(2);
  });

  it("keeps each disconnected tree internally centered", () => {
    const nodes = [
      makeNode("u1", "user", null, "left root"),
      makeNode("a1", "assistant", "u1", "left answer"),
      makeNode("u2", "user", null, "right root"),
      makeNode("a2", "assistant", "u2", "right answer that is much wider than root"),
    ];
    const sizes = new Map([
      ["u1", { width: 220, height: 90 }],
      ["a1", { width: 320, height: 130 }],
      ["u2", { width: 220, height: 90 }],
      ["a2", { width: 680, height: 240 }],
    ]);

    const result = buildFixedPositions(nodes, sizes);
    const xU1 = result.positions.get("u1")?.x ?? 0;
    const xA1 = result.positions.get("a1")?.x ?? 0;
    const xU2 = result.positions.get("u2")?.x ?? 0;
    const xA2 = result.positions.get("a2")?.x ?? 0;

    expect(Math.abs(xU1 - xA1)).toBeLessThan(0.001);
    expect(Math.abs(xU2 - xA2)).toBeLessThan(0.001);
  });
});
