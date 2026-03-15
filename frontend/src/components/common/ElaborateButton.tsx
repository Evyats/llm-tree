import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

interface ElaborateAction {
  nodeId: string;
  role: "user" | "assistant";
  text: string;
  occurrence: number;
  x: number;
  y: number;
}

interface ElaborateButtonProps {
  action: ElaborateAction | null;
  onElaborateClick: (action: ElaborateAction) => void;
  onReviseClick: (action: ElaborateAction) => void;
  onClose: () => void;
}

export default function ElaborateButton({ action, onElaborateClick, onReviseClick, onClose }: ElaborateButtonProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const isAssistantAction = action?.role === "assistant";

  const preserveSelection = (event: ReactMouseEvent | ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    if (!action) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!popupRef.current) {
        return;
      }
      if (popupRef.current.contains(event.target as Node)) {
        return;
      }
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [action, onClose]);

  if (!action) {
    return null;
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-30 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded border border-stone-300 bg-paper/95 p-1 shadow-float backdrop-blur"
      style={{ left: action.x, top: action.y }}
      onMouseDown={preserveSelection}
      onPointerDown={preserveSelection}
    >
      {isAssistantAction ? (
        <button
          className="rounded bg-warm px-2 py-1 text-xs text-white hover:opacity-90"
          onClick={() => onElaborateClick(action)}
          type="button"
          onMouseDown={preserveSelection}
          onPointerDown={preserveSelection}
        >
          Elaborate
        </button>
      ) : (
        <button
          className="rounded bg-stone-200 px-2 py-1 text-xs text-stone-700 hover:bg-stone-300"
          onClick={() => onReviseClick(action)}
          type="button"
          onMouseDown={preserveSelection}
          onPointerDown={preserveSelection}
        >
          Revise
        </button>
      )}
      <button
        className="rounded bg-stone-200 px-2 py-1 text-xs text-stone-700 hover:bg-stone-300"
        type="button"
        onMouseDown={preserveSelection}
        onPointerDown={preserveSelection}
      >
        Placeholder 2
      </button>
      <button
        className="rounded bg-stone-200 px-2 py-1 text-xs text-stone-700 hover:bg-stone-300"
        type="button"
        onMouseDown={preserveSelection}
        onPointerDown={preserveSelection}
      >
        Placeholder 3
      </button>
    </div>
  );
}
