import { describe, expect, it } from "vitest";
import type { Node } from "reactflow";

import { buildTranscriptUntilNode } from "../features/chat/transcript";
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

describe("buildTranscriptUntilNode", () => {
  it("returns root-to-target chain", () => {
    const nodes = [
      makeNode("u1", "user", null, "hello"),
      makeNode("a1", "assistant", "u1", "hi"),
      makeNode("u2", "user", "a1", "followup"),
    ];

    expect(buildTranscriptUntilNode(nodes, "u2")).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
      { role: "user", content: "followup" },
    ]);
  });
});
