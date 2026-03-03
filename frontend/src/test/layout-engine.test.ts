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

  it("keeps single-child continuation centered under shifted parent", () => {
    const nodes = [
      makeNode("u0", "user", null, "root"),
      makeNode("aL", "assistant", "u0", "left branch with very long text to force width and packing"),
      makeNode("uR", "user", "u0", "right branch user"),
      makeNode("aR", "assistant", "uR", "right branch assistant"),
      makeNode("uR2", "user", "aR", "right continuation"),
    ];
    const sizes = new Map([
      ["aL", { width: 700, height: 240 }],
      ["aR", { width: 320, height: 140 }],
      ["uR2", { width: 240, height: 96 }],
    ]);

    const result = buildFixedPositions(nodes, sizes);
    const xParent = result.positions.get("aR")?.x ?? 0;
    const xChild = result.positions.get("uR2")?.x ?? 0;
    expect(Math.abs(xParent - xChild)).toBeLessThan(0.001);
  });

  it("keeps exact row gap for single-child lane even with tall side branch", () => {
    const nodes = [
      makeNode("u1", "user", null, "1"),
      makeNode("aTall", "assistant", "u1", "very long assistant text to force a tall card in sibling branch"),
      makeNode("aMain", "assistant", "u1", "main lane assistant"),
      makeNode("u2", "user", "aMain", "2"),
      makeNode("a2", "assistant", "u2", "second assistant"),
    ];
    const sizes = new Map([
      ["u1", { width: 220, height: 90 }],
      ["aTall", { width: 760, height: 320 }],
      ["aMain", { width: 320, height: 140 }],
      ["u2", { width: 220, height: 90 }],
      ["a2", { width: 320, height: 140 }],
    ]);
    const rowGap = 26;
    const result = buildFixedPositions(nodes, sizes, { rowGap, siblingGap: 16 });
    const yU1 = result.positions.get("u1")?.y ?? 0;
    const yAMain = result.positions.get("aMain")?.y ?? 0;
    const yU2 = result.positions.get("u2")?.y ?? 0;
    const hU1 = result.sizeById.get("u1")?.height ?? 90;
    const hAMain = result.sizeById.get("aMain")?.height ?? 140;
    expect(Math.round(yAMain - (yU1 + hU1))).toBe(rowGap);
    expect(Math.round(yU2 - (yAMain + hAMain))).toBe(rowGap);
  });

  it("nudges parent row toward children anchors after refinement", () => {
    const nodes = [
      makeNode("u0", "user", null, "root"),
      makeNode("aL", "assistant", "u0", "left assistant"),
      makeNode("aM", "assistant", "u0", "middle assistant"),
      makeNode("uL", "user", "aL", "left child"),
      makeNode("uM", "user", "aM", "middle child"),
      makeNode("uM2", "user", "uM", "middle child deeper"),
    ];
    const sizes = new Map([
      ["aL", { width: 520, height: 200 }],
      ["aM", { width: 300, height: 130 }],
      ["uL", { width: 220, height: 90 }],
      ["uM", { width: 260, height: 96 }],
      ["uM2", { width: 260, height: 96 }],
    ]);
    const result = buildFixedPositions(nodes, sizes, { siblingGap: 10 });
    const xAL = result.positions.get("aL")?.x ?? 0;
    const xUL = result.positions.get("uL")?.x ?? 0;
    expect(Math.abs(xAL - xUL)).toBeLessThan(0.001);
  });

  it("avoids interleaving children of neighboring parents (prevents crossing)", () => {
    const nodes = [
      makeNode("u0", "user", null, "root"),
      makeNode("aL", "assistant", "u0", "left parent"),
      makeNode("aR", "assistant", "u0", "right parent"),
      makeNode("uL1", "user", "aL", "left child 1"),
      makeNode("uL2", "user", "aL", "left child 2"),
      makeNode("uR1", "user", "aR", "right child"),
    ];
    const sizes = new Map([
      ["aL", { width: 540, height: 200 }],
      ["aR", { width: 300, height: 130 }],
      ["uL1", { width: 220, height: 90 }],
      ["uL2", { width: 220, height: 90 }],
      ["uR1", { width: 220, height: 90 }],
    ]);
    const result = buildFixedPositions(nodes, sizes, { siblingGap: 8 });
    const xL1 = result.positions.get("uL1")?.x ?? 0;
    const xL2 = result.positions.get("uL2")?.x ?? 0;
    const xR1 = result.positions.get("uR1")?.x ?? 0;
    expect(Math.max(xL1, xL2)).toBeLessThan(xR1);
  });

  it("keeps single-child node centered even in crowded sibling row", () => {
    const nodes = [
      makeNode("u0", "user", null, "root"),
      makeNode("a1", "assistant", "u0", "left wide assistant"),
      makeNode("a2", "assistant", "u0", "middle assistant"),
      makeNode("a3", "assistant", "u0", "right assistant"),
      makeNode("u21", "user", "a2", "single child"),
      makeNode("u11", "user", "a1", "left child 1"),
      makeNode("u12", "user", "a1", "left child 2"),
    ];
    const sizes = new Map([
      ["a1", { width: 620, height: 220 }],
      ["a2", { width: 300, height: 130 }],
      ["a3", { width: 300, height: 130 }],
      ["u11", { width: 220, height: 90 }],
      ["u12", { width: 220, height: 90 }],
      ["u21", { width: 220, height: 90 }],
    ]);
    const result = buildFixedPositions(nodes, sizes, { siblingGap: 20 });
    const xA2 = result.positions.get("a2")?.x ?? 0;
    const xU21 = result.positions.get("u21")?.x ?? 0;
    expect(Math.abs(xA2 - xU21)).toBeLessThan(0.001);
  });

});
