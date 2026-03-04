import { memo, useRef, type MouseEvent, type PointerEvent } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

import { normalizeSelectionToWordBoundaries } from "../features/selection/normalizeSelection";
import type { NodeData } from "../store/useGraphStore";
import NodeActionButton from "./common/NodeActionButton";

interface UserNodeData extends NodeData {
  onOpenPanel?: (nodeId: string) => void;
  panelActive?: boolean;
  onSelectElaboration?: (nodeId: string, text: string, x: number, y: number) => void;
  contextMenuOpen?: boolean;
  onDeleteBranch?: (nodeId: string) => void;
  onPlaceholderTwo?: () => void;
  onToggleContextMenu?: (nodeId: string) => void;
}

const ACTION_RAIL_EXPANDED_WIDTH = 44;

function UserNode({ id, data, selected }: NodeProps<UserNodeData>) {
  const contentRef = useRef<HTMLParagraphElement>(null);
  const baseWidth = Math.min(520, 190 + data.text.length * 0.28);
  const contentWidth = Math.max(160, baseWidth - 32);

  const handleMouseUp = (event: MouseEvent) => {
    if (event.button !== 0) {
      return;
    }
    requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
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
    });
  };

  const stopActionPointer = (event: MouseEvent | PointerEvent) => {
    if (event.button === 0) {
      event.stopPropagation();
    }
  };

  return (
    <div
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        data.onToggleContextMenu?.(id);
      }}
      className={`rounded-2xl border bg-paper px-4 py-3 shadow-float transition-all ${
        selected ? "border-accent" : "border-stone-300"
      }`}
      style={{
        width: baseWidth + (data.contextMenuOpen ? ACTION_RAIL_EXPANDED_WIDTH : 0),
        transition: "width 260ms ease, border-color 200ms ease",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-none" style={{ width: contentWidth }}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-warm">User</div>
            <NodeActionButton
              className={`rounded px-2 py-1 text-xs text-white ${
                data.panelActive
                  ? "bg-[#a86424] shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)]"
                  : "bg-warm hover:opacity-90"
              }`}
              onClick={() => {
                data.onOpenPanel?.(id);
              }}
              ariaLabel="Open context panel"
              title="Open context panel"
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 4H4v3M13 4h3v3M4 13v3h3M16 13v3h-3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 8h4v4H8z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </NodeActionButton>
          </div>
          <p
            ref={contentRef}
            onMouseDown={(event) => {
              if (event.button === 0) {
                event.stopPropagation();
              }
            }}
            onPointerDown={(event) => {
              if (event.button === 0) {
                event.stopPropagation();
              }
            }}
            onMouseUp={handleMouseUp}
            className="nodrag nopan cursor-text select-text whitespace-pre-wrap text-sm leading-relaxed text-ink"
          >
            {data.text}
          </p>
        </div>
        {data.contextMenuOpen && (
          <div className="flex w-fit flex-col justify-start gap-2 border-l border-stone-300 pl-2.5 pt-0.5">
            <button
              type="button"
              data-node-action-button="true"
              className="nodrag nopan flex h-7 w-7 items-center justify-center rounded text-red-700 hover:bg-red-50"
              onMouseDown={stopActionPointer}
              onPointerDown={stopActionPointer}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onDeleteBranch?.(id);
              }}
              title="Delete branch"
              aria-label="Delete branch"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h12M8 6V4h4v2M7 6l.6 9h4.8L13 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              data-node-action-button="true"
              className="nodrag nopan flex h-7 w-7 items-center justify-center rounded text-stone-700 hover:bg-stone-100"
              onMouseDown={stopActionPointer}
              onPointerDown={stopActionPointer}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onPlaceholderTwo?.();
              }}
              title="Extract path"
              aria-label="Extract path"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 4v5a3 3 0 0 0 3 3h5" strokeLinecap="round" />
                <path d="M14 12l-2-2m2 2l-2 2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 4h2M4 16h2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(UserNode);
