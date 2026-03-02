import { describe, expect, it } from "vitest";

import { useGraphStore } from "../store/useGraphStore";

describe("graph store", () => {
  it("updates assistant variant text when cycling", () => {
    useGraphStore.setState({
      graphId: "g1",
      title: "T",
      nodes: [
        {
          id: "n1",
          type: "assistantNode",
          position: { x: 0, y: 0 },
          data: {
            role: "assistant",
            parentId: null,
            text: "medium",
            variants: { short: "short", medium: "medium", long: "long" },
            variantIndex: 1,
            mode: "normal",
            highlightedText: null,
          },
        },
      ],
      edges: [],
      selectedNodeId: null,
      panelOpen: false,
      transcript: [],
      responseSource: null,
    });

    useGraphStore.getState().updateNodeVariant("n1", 2);
    const updated = useGraphStore.getState().nodes[0];
    expect(updated.data.variantIndex).toBe(2);
    expect(updated.data.text).toBe("long");
  });
});
