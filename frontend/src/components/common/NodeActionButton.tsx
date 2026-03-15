import type { ReactNode, SyntheticEvent } from "react";

interface NodeActionButtonProps {
  className: string;
  ariaLabel: string;
  title?: string;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: ReactNode;
}

export default function NodeActionButton({
  className,
  ariaLabel,
  title,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}: NodeActionButtonProps) {
  const consumeEvent = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <button
      className={className}
      onMouseDown={consumeEvent}
      onPointerDown={consumeEvent}
      onClick={(event) => {
        consumeEvent(event);
        onClick();
      }}
      type="button"
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </button>
  );
}
