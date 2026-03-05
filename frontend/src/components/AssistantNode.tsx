import { memo, useRef, type MouseEvent, type PointerEvent } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

import { estimateNodeFrame } from "../features/layout/nodeSizing";
import { normalizeSelectionToWordBoundaries } from "../features/selection/normalizeSelection";
import type { NodeData } from "../store/useGraphStore";
import NodeActionButton from "./common/NodeActionButton";
import MarkdownPreview from "./common/MarkdownPreview";

interface AssistantNodeData extends NodeData {
  onCycleVariant?: (nodeId: string, direction: -1 | 1) => void;
  onApproveVariant?: (nodeId: string) => void;
  onSelectElaboration?: (nodeId: string, text: string, x: number, y: number) => void;
  onOpenPanel?: (nodeId: string) => void;
  panelActive?: boolean;
  contextMenuOpen?: boolean;
  onDeleteBranch?: (nodeId: string) => void;
  onPlaceholderTwo?: () => void;
  onHoverWheelStart?: (nodeId: string) => void;
  onHoverWheelEnd?: (nodeId: string) => void;
  onHoverWheelScroll?: (nodeId: string, deltaY: number) => boolean;
  onToggleContextMenu?: (nodeId: string) => void;
}

const ACTION_RAIL_EXPANDED_WIDTH = 44;

function AssistantNode({ id, data, selected }: NodeProps<AssistantNodeData>) {
  const contentRef = useRef<HTMLDivElement>(null);
  const wheelEligible = !data.variantLocked && !!data.variants;
  const canCycleVariants = !data.pending && !data.variantLocked && !!data.variants;
  const minControlsContentWidth = canCycleVariants ? 300 : 120;
  const size = estimateNodeFrame("assistant", data.text, {
    forceMinContentWidth: minControlsContentWidth,
    extraMinWidth: canCycleVariants ? 180 : 0,
  });
  const contentWidth = Math.max(minControlsContentWidth, size.contentWidth);

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
      onMouseEnter={() => {
        if (!wheelEligible) return;
        data.onHoverWheelStart?.(id);
      }}
      onMouseLeave={() => {
        if (!wheelEligible) return;
        data.onHoverWheelEnd?.(id);
      }}
      onWheel={(event) => {
        if (!wheelEligible) return;
        const handled = data.onHoverWheelScroll?.(id, event.deltaY) ?? false;
        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        data.onToggleContextMenu?.(id);
      }}
      className={`rounded-2xl border bg-white px-4 py-3 shadow-float transition-all duration-300 ${
        selected ? "border-accent" : "border-stone-300"
      }`}
      style={{
        width: size.width + (data.contextMenuOpen ? ACTION_RAIL_EXPANDED_WIDTH : 0),
        minHeight: size.minHeight,
        transition: "width 260ms ease, border-color 200ms ease",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-none" style={{ width: contentWidth }}>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">Assistant</div>
              {canCycleVariants && (
                <>
                  <NodeActionButton
                    className="rounded bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
                    onClick={() => {
                      data.onCycleVariant?.(id, -1);
                    }}
                    ariaLabel="Previous variant"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12L10 7L15 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </NodeActionButton>
                  <NodeActionButton
                    className="rounded bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
                    onClick={() => {
                      data.onCycleVariant?.(id, 1);
                    }}
                    ariaLabel="Next variant"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 8L10 13L15 8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </NodeActionButton>
                  <NodeActionButton
                    className="rounded bg-stone-100 px-2 py-1 text-xs hover:bg-stone-200"
                    onClick={() => {
                      data.onApproveVariant?.(id);
                    }}
                    ariaLabel="Approve current variant"
                    title="Approve current variant"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </NodeActionButton>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canCycleVariants && (
                <div className="h-1.5 w-10 overflow-hidden rounded-full bg-stone-200" aria-hidden>
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-200"
                    style={{ width: `${((data.variantIndex + 1) / 3) * 100}%` }}
                  />
                </div>
              )}
              <NodeActionButton
                className={`rounded px-2 py-1 text-xs text-white ${
                  data.panelActive
                    ? "bg-[#0f5d77] shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)]"
                    : "bg-accent hover:opacity-90"
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
          </div>
          <div
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
            className="nodrag nopan cursor-text select-text text-sm leading-relaxed text-ink"
          >
            {data.pending ? (
              <span className="inline-flex items-center gap-1.5 text-stone-500" aria-label="Generating response">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent/70 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent/70 [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent/70 [animation-delay:240ms]" />
              </span>
            ) : (
              <MarkdownPreview text={data.text} highlights={data.elaboratedSelections} />
            )}
          </div>
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

export default memo(AssistantNode);
