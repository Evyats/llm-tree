interface ElaborateAction {
  nodeId: string;
  text: string;
  x: number;
  y: number;
}

interface ElaborateButtonProps {
  action: ElaborateAction | null;
  onClick: (action: ElaborateAction) => void;
}

export default function ElaborateButton({ action, onClick }: ElaborateButtonProps) {
  if (!action) {
    return null;
  }

  return (
    <button
      className="fixed z-30 rounded bg-warm px-3 py-1 text-xs text-white shadow-float"
      style={{ left: action.x, top: action.y }}
      onClick={() => onClick(action)}
      type="button"
    >
      Elaborate
    </button>
  );
}
