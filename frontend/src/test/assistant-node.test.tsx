import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "reactflow";
import { describe, expect, it, vi } from "vitest";

import AssistantNode from "../components/AssistantNode";

describe("AssistantNode", () => {
  it("calls variant cycle callbacks on arrow clicks", () => {
    const onCycleVariant = vi.fn();
    render(
      <ReactFlowProvider>
        <AssistantNode
          id="node-1"
          data={{
            role: "assistant",
            parentId: null,
            text: "content",
            variants: { short: "s", medium: "m", long: "l" },
            variantIndex: 1,
            mode: "normal",
            highlightedText: null,
            onCycleVariant,
          }}
          type="assistantNode"
          selected={false}
          zIndex={0}
          dragging={false}
          isConnectable={false}
          xPos={0}
          yPos={0}
        />
      </ReactFlowProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous variant" }));
    fireEvent.click(screen.getByRole("button", { name: "Next variant" }));

    expect(onCycleVariant).toHaveBeenNthCalledWith(1, "node-1", -1);
    expect(onCycleVariant).toHaveBeenNthCalledWith(2, "node-1", 1);
  });
});
