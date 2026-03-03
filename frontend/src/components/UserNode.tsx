import { memo, useRef } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

import { normalizeSelectionToWordBoundaries } from "../features/selection/normalizeSelection";
import type { NodeData } from "../store/useGraphStore";

interface UserNodeData extends NodeData {
  onOpenPanel?: (nodeId: string) => void;
  onSelectElaboration?: (nodeId: string, text: string, x: number, y: number) => void;
}

function UserNode({ id, data, selected }: NodeProps<UserNodeData>) {
  const contentRef = useRef<HTMLParagraphElement>(null);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    if (!contentRef.current || !contentRef.current.contains(selection.anchorNode)) {
      return;
    }
    const text = normalizeSelectionToWordBoundaries(selection, contentRef.current);
    if (!text) {
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    data.onSelectElaboration?.(id, text, rect.left + rect.width / 2, rect.top);
  };

  return (
    <div
      onDoubleClick={(event) => event.stopPropagation()}
      className={`rounded-2xl border bg-paper px-4 py-3 shadow-float transition-all ${
        selected ? "border-accent" : "border-stone-300"
      }`}
      style={{ width: Math.min(520, 190 + data.text.length * 0.28) }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-warm">User</div>
        <button
          className="rounded bg-warm px-2 py-1 text-xs text-white hover:opacity-90"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            data.onOpenPanel?.(id);
          }}
          type="button"
          aria-label="Open context panel"
          title="Open context panel"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 4H4v3M13 4h3v3M4 13v3h3M16 13v3h-3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 8h4v4H8z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <p
        ref={contentRef}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseUp={handleMouseUp}
        className="nodrag nopan cursor-text select-text whitespace-pre-wrap text-sm leading-relaxed text-ink"
      >
        {data.text}
      </p>
    </div>
  );
}

export default memo(UserNode);
