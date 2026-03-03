import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

interface CollapsedNodeData {
  label: string;
  hiddenCount: number;
  onUnfold: () => void;
}

function CollapsedNode({ data, selected }: NodeProps<CollapsedNodeData>) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 shadow-float ${
        selected ? "border-accent bg-amber-50" : "border-amber-400 bg-amber-50"
      }`}
      style={{ width: 132 }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">{data.label}</div>
      <div className="mb-2 text-[11px] text-stone-800">{data.hiddenCount} hidden</div>
      <button
        className="w-full rounded bg-accent px-2 py-1 text-[11px] text-white hover:opacity-90"
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          data.onUnfold();
        }}
      >
        Unfold
      </button>
    </div>
  );
}

export default memo(CollapsedNode);
