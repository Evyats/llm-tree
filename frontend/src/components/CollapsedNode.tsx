import { memo, useLayoutEffect } from "react";
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from "reactflow";

interface CollapsedNodeData {
  label: string;
  previewText: string;
  hiddenCount: number;
  onUnfold: () => void;
  compacting?: boolean;
  contextMenuOpen?: boolean;
  onDeleteBranch?: (nodeId: string) => void;
  onToggleContextMenu?: (nodeId: string) => void;
}

const ACTION_RAIL_EXPANDED_WIDTH = 44;

function CollapsedNode({ id, data, selected }: NodeProps<CollapsedNodeData>) {
  const updateNodeInternals = useUpdateNodeInternals();

  useLayoutEffect(() => {
    updateNodeInternals(id);
    const raf = requestAnimationFrame(() => updateNodeInternals(id));
    const timeout = window.setTimeout(() => updateNodeInternals(id), 80);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [data.contextMenuOpen, data.hiddenCount, data.previewText, id, updateNodeInternals]);

  return (
    <div
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        data.onUnfold();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        data.onToggleContextMenu?.(id);
      }}
      className={`rounded-xl border px-3 py-2 shadow-float ${
        selected ? "border-accent bg-amber-50" : "border-amber-400 bg-amber-50"
      } ${data.compacting ? "pointer-events-none opacity-45 saturate-50" : ""}`}
      style={{ width: 132 + (data.contextMenuOpen ? ACTION_RAIL_EXPANDED_WIDTH : 0) }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">{data.label}</div>
          <div className="mb-1 text-[11px] leading-snug text-stone-800">{data.previewText}</div>
          <div className="mb-2 text-[11px] text-stone-800">{data.hiddenCount} hidden</div>
          <button
            className="mx-auto block rounded bg-accent px-2 py-1 text-xs text-white hover:opacity-90"
            type="button"
            title="Unfold"
            aria-label="Unfold"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              data.onUnfold();
            }}
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 8L10 13L15 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {data.contextMenuOpen && (
          <div className="flex w-fit flex-col justify-start gap-2 border-l border-stone-300 pl-2.5 pt-0.5">
            <button
              type="button"
              data-node-action-button="true"
              className="nodrag nopan flex h-7 w-7 items-center justify-center rounded text-red-700 hover:bg-red-50"
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
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(CollapsedNode);
