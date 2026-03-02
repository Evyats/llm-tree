import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

import type { NodeData } from "../store/useGraphStore";

function UserNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`rounded-2xl border bg-paper px-4 py-3 shadow-float transition-all ${
        selected ? "border-accent" : "border-stone-300"
      }`}
      style={{ width: Math.min(520, 190 + data.text.length * 0.28) }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warm">User</div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{data.text}</p>
    </div>
  );
}

export default memo(UserNode);
