import { memo, useLayoutEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

import { normalizeSelectionToWordBoundaries } from "../features/selection/normalizeSelection";
import type { NodeData } from "../store/useGraphStore";
import NodeActionButton from "./common/NodeActionButton";

interface AssistantNodeData extends NodeData {
  onCycleVariant?: (nodeId: string, direction: -1 | 1) => void;
  onSelectElaboration?: (nodeId: string, text: string, x: number, y: number) => void;
  onOpenPanel?: (nodeId: string) => void;
  contextMenuOpen?: boolean;
  onDeleteBranch?: (nodeId: string) => void;
  onPlaceholderTwo?: () => void;
  onPlaceholderThree?: () => void;
  onHoverWheelStart?: (nodeId: string) => void;
  onHoverWheelEnd?: (nodeId: string) => void;
  onHoverWheelScroll?: (nodeId: string, deltaY: number) => boolean;
}

function AssistantNode({ id, data, selected }: NodeProps<AssistantNodeData>) {
  const measureRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLParagraphElement>(null);
  const sizeCacheRef = useRef<Map<string, { w: number; h: number }>>(new Map());
  const [size, setSize] = useState({ w: 320, h: 140 });
  const wheelEligible = !data.variantLocked && !!data.variants;

  useLayoutEffect(() => {
    const cacheKey = data.text;
    const cached = sizeCacheRef.current.get(cacheKey);
    if (cached) {
      setSize(cached);
      return;
    }
    if (!measureRef.current) {
      return;
    }
    const nextW = Math.min(700, Math.max(240, measureRef.current.scrollWidth + 36));
    const nextH = Math.min(680, Math.max(110, measureRef.current.scrollHeight + 62));
    const measured = { w: nextW, h: nextH };
    sizeCacheRef.current.set(cacheKey, measured);
    setSize(measured);
  }, [data.text]);

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
      onDoubleClick={(event) => event.stopPropagation()}
      className={`rounded-2xl border bg-white px-4 py-3 shadow-float transition-all duration-300 ${
        selected ? "border-accent" : "border-stone-300"
      }`}
      style={{
        width: size.w + (data.contextMenuOpen ? 156 : 0),
        height: data.contextMenuOpen ? Math.max(size.h, 172) : size.h,
        transition: "width 260ms ease, height 260ms ease, border-color 200ms ease",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="flex h-full items-stretch gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-accent">Assistant</div>
              {!data.variantLocked && (
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
                </>
              )}
            </div>
            {!data.variantLocked && (
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-200" aria-hidden>
                <div
                  className="h-full rounded-full bg-accent transition-all duration-200"
                  style={{ width: `${((data.variantIndex + 1) / 3) * 100}%` }}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <NodeActionButton
                className="rounded bg-accent px-2 py-1 text-xs text-white hover:opacity-90"
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
        {data.contextMenuOpen && (
          <div className="flex min-w-[136px] flex-col justify-center gap-2 border-l border-stone-300 pl-3">
            <button
              type="button"
              data-node-action-button="true"
              className="rounded px-2 py-1 text-left text-xs text-red-700 hover:bg-red-50"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onDeleteBranch?.(id);
              }}
            >
              Delete Branch
            </button>
            <button
              type="button"
              data-node-action-button="true"
              className="rounded px-2 py-1 text-left text-xs text-stone-700 hover:bg-stone-100"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onPlaceholderTwo?.();
              }}
            >
              Extract Path
            </button>
            <button
              type="button"
              data-node-action-button="true"
              className="rounded px-2 py-1 text-left text-xs text-stone-700 hover:bg-stone-100"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                data.onPlaceholderThree?.();
              }}
            >
              Placeholder 3
            </button>
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute -z-10 opacity-0">
        <p
          ref={measureRef}
          className="inline-block whitespace-pre-wrap text-sm leading-relaxed"
          style={{ width: "fit-content", maxWidth: "660px" }}
        >
          {data.text}
        </p>
      </div>
    </div>
  );
}

export default memo(AssistantNode);
