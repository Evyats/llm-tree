import { memo, useLayoutEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from "reactflow";

import { estimateNodeFrame } from "../features/layout/nodeSizing";
import { getActionPreviewClasses } from "../features/graph/actionPreview";
import { NODE_TEXT_PREVIEW_MAX_HEIGHT_PX } from "../features/graph/nodeTextPreview";
import type { GraphNodeUiData } from "../features/graph/nodeUi";
import NodeActionButton from "./common/NodeActionButton";
import NodeHeaderRow from "./common/NodeHeaderRow";
import MarkdownPreview from "./common/MarkdownPreview";

const ACTION_RAIL_EXPANDED_WIDTH = 44;

function AssistantNode({ id, data, selected }: NodeProps<GraphNodeUiData>) {
  const contentRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const isSummaryNode = data.mode === "summary";
  const wheelEligible = !data.variantLocked && !!data.variants;
  const canCycleVariants = !data.pending && !data.variantLocked && !!data.variants;
  const variantControlsWidth = canCycleVariants ? 104 : 0;
  const minControlsContentWidth = canCycleVariants ? 198 : 120;
  const renderedText = data.displayText ?? data.text;
  const size = estimateNodeFrame("assistant", renderedText, {
    forceMinContentWidth: minControlsContentWidth,
    extraMinWidth: canCycleVariants ? 56 : 0,
  });
  const contentWidth = Math.max(minControlsContentWidth, size.contentWidth);
  const actionPreviewClass = getActionPreviewClasses(!!data.actionPreviewActive, data.actionPreviewStyle ?? "outline");
  const baseBorderClass = selected
    ? (isSummaryNode ? "border-[#8a5b2b]" : "border-accent")
    : (isSummaryNode ? "border-[#d7b58b]" : "border-stone-300");
  const baseBackgroundClass = isSummaryNode ? "bg-[#fff8ef]" : "bg-white";
  const roleTextClass = isSummaryNode ? "text-[#8a5b2b]" : "text-accent";

  const stopActionPointer = (event: MouseEvent | PointerEvent) => {
    if (event.button === 0) {
      event.stopPropagation();
    }
  };

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => updateNodeInternals(id));
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [
    data.contextMenuOpen,
    data.pending,
    data.sizingSignature,
    data.text,
    data.variantIndex,
    data.variantLocked,
    id,
    updateNodeInternals,
  ]);

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
        const handled = data.onHoverWheelScroll?.(id, event.deltaY, event.clientX, event.clientY) ?? false;
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
      className={`rounded-2xl border px-4 py-3 shadow-float transition-all duration-300 ${
        baseBorderClass
      } ${baseBackgroundClass} ${data.compacting ? "pointer-events-none opacity-45 saturate-50" : ""} ${actionPreviewClass}`}
      style={{
        width: size.width + (data.contextMenuOpen ? ACTION_RAIL_EXPANDED_WIDTH : 0),
        minHeight: size.minHeight,
        transition: "border-color 200ms ease",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-none" style={{ width: contentWidth }}>
          <NodeHeaderRow
            left={
              <>
                <div className={`text-[11px] font-semibold uppercase tracking-wide ${roleTextClass}`}>
                  {isSummaryNode ? "Summary" : "Assistant"}
                </div>
                {canCycleVariants && (
                  <div className="flex items-center gap-2" style={{ width: variantControlsWidth }}>
                    <NodeActionButton
                      className="flex h-5 w-5 items-center justify-center rounded bg-stone-100 text-xs hover:bg-stone-200"
                      onClick={() => {
                        data.onCycleVariant?.(id, -1);
                      }}
                      ariaLabel="Previous variant"
                    >
                      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12L10 7L15 12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </NodeActionButton>
                    <NodeActionButton
                      className="flex h-5 w-5 items-center justify-center rounded bg-stone-100 text-xs hover:bg-stone-200"
                      onClick={() => {
                        data.onCycleVariant?.(id, 1);
                      }}
                      ariaLabel="Next variant"
                    >
                      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 8L10 13L15 8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </NodeActionButton>
                    <NodeActionButton
                      className="flex h-5 w-5 items-center justify-center rounded bg-stone-100 text-xs hover:bg-stone-200"
                      onClick={() => {
                        data.onApproveVariant?.(id);
                      }}
                      ariaLabel="Approve current variant"
                      title="Approve current variant"
                    >
                      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </NodeActionButton>
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded"
                      aria-hidden
                    >
                      <div className="h-1.5 w-6 overflow-hidden rounded-full bg-stone-200">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-200"
                          style={{ width: `${((data.variantIndex + 1) / 3) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            }
            right={null}
          />
          <div className="relative">
            <div
              ref={contentRef}
              data-node-text-content="true"
              data-node-id={id}
              data-node-role={data.role}
              onMouseDownCapture={(event) => {
                if (event.button === 0) {
                  event.stopPropagation();
                }
              }}
              onMouseDown={(event) => {
                if (event.button === 0) {
                  event.stopPropagation();
                }
              }}
              onPointerDownCapture={(event) => {
                if (event.button === 0) {
                  event.stopPropagation();
                }
              }}
              onPointerDown={(event) => {
                if (event.button === 0) {
                  event.stopPropagation();
                }
              }}
              onMouseUpCapture={(event) => {
                if (event.button === 0) {
                  event.stopPropagation();
                }
              }}
              onClickCapture={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
              className="nodrag nopan cursor-text select-text text-sm leading-relaxed text-ink"
              style={
                data.textExpandable && !data.textExpanded
                  ? { maxHeight: `${NODE_TEXT_PREVIEW_MAX_HEIGHT_PX}px`, overflow: "hidden" }
                  : undefined
              }
            >
              {data.pending ? (
                <span className="inline-flex items-center gap-1.5 text-stone-500" aria-label="Generating response">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent/70 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent/70 [animation-delay:120ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent/70 [animation-delay:240ms]" />
                </span>
              ) : (
                <MarkdownPreview text={renderedText} highlights={data.elaboratedSelections} />
              )}
            </div>
            {data.textExpandable && !data.textExpanded && !data.pending && (
              <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 ${
                  isSummaryNode
                    ? "bg-[linear-gradient(to_bottom,rgba(255,248,239,0),rgba(255,248,239,0.98))]"
                    : "bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0.98))]"
                }`}
              />
            )}
          </div>
          {data.textExpandable && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="rounded bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-200"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  data.onToggleExpandedText?.(id);
                }}
              >
                {data.textExpanded ? "Show less" : "Show more"}
              </button>
            </div>
          )}
        </div>
        {data.contextMenuOpen && (
          <div className="flex w-fit flex-col justify-start gap-2 border-l border-stone-300 pl-2.5 pt-0.5">
            <button
              type="button"
              data-node-action-button="true"
              className={`nodrag nopan flex h-7 w-7 items-center justify-center rounded ${
                data.panelActive
                  ? "bg-accent/15 text-accent shadow-[inset_0_1px_3px_rgba(0,0,0,0.18)]"
                  : "text-stone-700 hover:bg-stone-100"
              }`}
              onMouseDown={stopActionPointer}
              onPointerDown={stopActionPointer}
              onMouseEnter={() => data.onActionPreviewStart?.(id, "context")}
              onMouseLeave={() => data.onActionPreviewEnd?.()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onActionPreviewEnd?.();
                data.onOpenPanel?.(id);
              }}
              title="Open context panel"
              aria-label="Open context panel"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 4H4v3M13 4h3v3M4 13v3h3M16 13v3h-3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 8h4v4H8z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              data-node-action-button="true"
              className="nodrag nopan flex h-7 w-7 items-center justify-center rounded text-stone-700 hover:bg-stone-100"
              onMouseDown={stopActionPointer}
              onPointerDown={stopActionPointer}
              onMouseEnter={() => data.onActionPreviewStart?.(id, "extract")}
              onMouseLeave={() => data.onActionPreviewEnd?.()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onActionPreviewEnd?.();
                data.onExtractPath?.(id);
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
            <div className="mx-1 h-px bg-stone-300" aria-hidden />
            <button
              type="button"
              data-node-action-button="true"
              className="nodrag nopan flex h-7 w-7 items-center justify-center rounded text-stone-700 hover:bg-stone-100"
              onMouseDown={stopActionPointer}
              onPointerDown={stopActionPointer}
              onMouseEnter={() => data.onActionPreviewStart?.(id, "compact")}
              onMouseLeave={() => data.onActionPreviewEnd?.()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onActionPreviewEnd?.();
                data.onCompactBranch?.(id);
              }}
              title="Compact branch"
              aria-label="Compact branch"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h8M4 10h8M4 14h8" strokeLinecap="round" />
                <path d="M14 5l2 2-2 2M14 9l2 2-2 2M14 13l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              data-node-action-button="true"
              className="nodrag nopan flex h-7 w-7 items-center justify-center rounded text-red-700 hover:bg-red-50"
              onMouseDown={stopActionPointer}
              onPointerDown={stopActionPointer}
              onMouseEnter={() => data.onActionPreviewStart?.(id, "delete")}
              onMouseLeave={() => data.onActionPreviewEnd?.()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onActionPreviewEnd?.();
                data.onDeleteBranch?.(id);
              }}
              title="Delete branch"
              aria-label="Delete branch"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h12M8 6V4h4v2M7 6l.6 9h4.8L13 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(AssistantNode);
