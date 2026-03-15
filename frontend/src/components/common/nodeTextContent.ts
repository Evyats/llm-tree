import type { HTMLAttributes, MouseEvent, PointerEvent } from "react";

type PointerLikeEvent =
  | MouseEvent<HTMLElement>
  | PointerEvent<HTMLElement>;

function stopPrimaryPointerPropagation(event: PointerLikeEvent) {
  if (event.button === 0) {
    event.stopPropagation();
  }
}

export function getNodeTextContentProps(
  nodeId: string,
  role: "user" | "assistant"
): HTMLAttributes<HTMLDivElement> {
  return {
    "data-node-text-content": "true",
    "data-node-id": nodeId,
    "data-node-role": role,
    onMouseDownCapture: stopPrimaryPointerPropagation,
    onMouseDown: stopPrimaryPointerPropagation,
    onPointerDownCapture: stopPrimaryPointerPropagation,
    onPointerDown: stopPrimaryPointerPropagation,
    onMouseUpCapture: stopPrimaryPointerPropagation,
    onClickCapture: (event) => {
      event.stopPropagation();
    },
    onClick: (event) => {
      event.stopPropagation();
    },
  } as HTMLAttributes<HTMLDivElement>;
}
