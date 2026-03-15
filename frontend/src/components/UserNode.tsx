import { memo, useLayoutEffect } from "react";
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from "reactflow";

import { getActionPreviewClasses } from "../features/graph/actionPreview";
import { NODE_TEXT_PREVIEW_MAX_HEIGHT_PX } from "../features/graph/nodeTextPreview";
import type { GraphNodeUiData } from "../features/graph/nodeUi";
import { estimateNodeFrame } from "../features/layout/nodeSizing";
import NodeActionRail from "./common/NodeActionRail";
import NodeHeaderRow from "./common/NodeHeaderRow";
import MarkdownPreview from "./common/MarkdownPreview";
import { getNodeTextContentProps } from "./common/nodeTextContent";

const ACTION_RAIL_EXPANDED_WIDTH = 44;

function UserNode({ id, data, selected }: NodeProps<GraphNodeUiData>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const renderedText = data.displayText ?? data.text;
  const size = estimateNodeFrame("user", renderedText);
  const actionPreviewClass = getActionPreviewClasses(!!data.actionPreviewActive, data.actionPreviewStyle ?? "outline");
  const textContentProps = getNodeTextContentProps(id, data.role);
  const actionRailItems = [
    {
      key: "context",
      label: "Open context panel",
      className: data.panelActive
        ? "bg-accent/15 text-accent shadow-[inset_0_1px_3px_rgba(0,0,0,0.18)]"
        : "text-stone-700 hover:bg-stone-100",
      onMouseEnter: () => data.onActionPreviewStart?.(id, "context"),
      onMouseLeave: () => data.onActionPreviewEnd?.(),
      onClick: () => {
        data.onActionPreviewEnd?.();
        data.onOpenPanel?.(id);
      },
      icon: (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 4H4v3M13 4h3v3M4 13v3h3M16 13v3h-3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 8h4v4H8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: "extract",
      label: "Extract path",
      onMouseEnter: () => data.onActionPreviewStart?.(id, "extract"),
      onMouseLeave: () => data.onActionPreviewEnd?.(),
      onClick: () => {
        data.onActionPreviewEnd?.();
        data.onExtractPath?.(id);
      },
      icon: (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 4v5a3 3 0 0 0 3 3h5" strokeLinecap="round" />
          <path d="M14 12l-2-2m2 2l-2 2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 4h2M4 16h2" strokeLinecap="round" />
        </svg>
      ),
    },
    null,
    {
      key: "compact",
      label: "Compact branch",
      onMouseEnter: () => data.onActionPreviewStart?.(id, "compact"),
      onMouseLeave: () => data.onActionPreviewEnd?.(),
      onClick: () => {
        data.onActionPreviewEnd?.();
        data.onCompactBranch?.(id);
      },
      icon: (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6h8M4 10h8M4 14h8" strokeLinecap="round" />
          <path d="M14 5l2 2-2 2M14 9l2 2-2 2M14 13l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: "delete",
      label: "Delete branch",
      className: "text-red-700 hover:bg-red-50",
      onMouseEnter: () => data.onActionPreviewStart?.(id, "delete"),
      onMouseLeave: () => data.onActionPreviewEnd?.(),
      onClick: () => {
        data.onActionPreviewEnd?.();
        data.onDeleteBranch?.(id);
      },
      icon: (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6h12M8 6V4h4v2M7 6l.6 9h4.8L13 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => updateNodeInternals(id));
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [data.contextMenuOpen, data.sizingSignature, data.text, id, updateNodeInternals]);

  return (
    <div
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        data.onToggleContextMenu?.(id);
      }}
      className={`rounded-2xl border bg-paper px-4 py-3 shadow-float transition-all ${
        selected ? "border-accent" : "border-stone-300"
      } ${data.compacting ? "pointer-events-none opacity-45 saturate-50" : ""} ${actionPreviewClass}`}
      style={{
        width: size.width + (data.contextMenuOpen ? ACTION_RAIL_EXPANDED_WIDTH : 0),
        minHeight: size.minHeight,
        transition: "border-color 200ms ease",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-none" style={{ width: size.contentWidth }}>
          <NodeHeaderRow
            className="mb-1"
            left={<div className="text-[11px] font-semibold uppercase tracking-wide text-warm">User</div>}
            right={null}
          />
          <div className="relative">
            <div
              {...textContentProps}
              className="nodrag nopan cursor-text select-text text-sm leading-relaxed text-ink"
              style={
                data.textExpandable && !data.textExpanded
                  ? { maxHeight: `${NODE_TEXT_PREVIEW_MAX_HEIGHT_PX}px`, overflow: "hidden" }
                  : undefined
              }
            >
              <MarkdownPreview text={renderedText} highlights={data.elaboratedSelections} />
            </div>
            {data.textExpandable && !data.textExpanded && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(to_bottom,rgba(246,243,234,0),rgba(246,243,234,0.98))]" />
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
        {data.contextMenuOpen && <NodeActionRail items={actionRailItems} />}
      </div>
    </div>
  );
}

export default memo(UserNode);
