import type { MouseEvent, PointerEvent, ReactNode } from "react";

interface NodeActionRailItem {
  key: string;
  label: string;
  title?: string;
  className?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick: () => void;
  icon: ReactNode;
}

interface NodeActionRailProps {
  items: Array<NodeActionRailItem | null>;
}

function stopPrimaryPointer(event: MouseEvent | PointerEvent) {
  if (event.button === 0) {
    event.stopPropagation();
  }
}

export default function NodeActionRail({ items }: NodeActionRailProps) {
  return (
    <div className="flex w-fit flex-col justify-start gap-2 border-l border-stone-300 pl-2.5 pt-0.5">
      {items.map((item, index) =>
        item ? (
          <button
            key={item.key}
            type="button"
            data-node-action-button="true"
            className={`nodrag nopan flex h-7 w-7 items-center justify-center rounded ${
              item.className ?? "text-stone-700 hover:bg-stone-100"
            }`}
            onMouseDown={stopPrimaryPointer}
            onPointerDown={stopPrimaryPointer}
            onMouseEnter={item.onMouseEnter}
            onMouseLeave={item.onMouseLeave}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              item.onClick();
            }}
            title={item.title ?? item.label}
            aria-label={item.label}
          >
            {item.icon}
          </button>
        ) : (
          <div key={`divider-${index}`} className="mx-1 h-px bg-stone-300" aria-hidden />
        )
      )}
    </div>
  );
}
