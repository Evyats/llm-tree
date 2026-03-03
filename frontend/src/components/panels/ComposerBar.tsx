import type { RefObject } from "react";

interface ComposerBarProps {
  selectedNodeId: string | null;
  showFullSelectedNodeId: boolean;
  composerText: string;
  loading: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  onToggleSelectedNodeIdMode: () => void;
  onComposerTextChange: (value: string) => void;
  onSend: () => void;
}

export default function ComposerBar({
  selectedNodeId,
  showFullSelectedNodeId,
  composerText,
  loading,
  inputRef,
  onToggleSelectedNodeIdMode,
  onComposerTextChange,
  onSend,
}: ComposerBarProps) {
  const selectedLabel = selectedNodeId
    ? showFullSelectedNodeId
      ? selectedNodeId
      : selectedNodeId.slice(0, 2)
    : "none";

  return (
    <footer className="z-20 flex items-center gap-2 border-t border-stone-300 bg-paper/90 px-2 py-2 backdrop-blur md:px-3">
      <div className="flex items-center gap-1.5 rounded bg-stone-100 px-2 py-1 text-xs">
        <span>selected: {selectedLabel}</span>
        {selectedNodeId && (
          <button
            type="button"
            className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] hover:bg-stone-300"
            onClick={onToggleSelectedNodeIdMode}
            title={showFullSelectedNodeId ? "Show compact ID" : "Show full ID"}
            aria-label={showFullSelectedNodeId ? "Show compact ID" : "Show full ID"}
          >
            {showFullSelectedNodeId ? "−" : "+"}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
        placeholder="Write a message for the selected node branch..."
        value={composerText}
        onChange={(event) => onComposerTextChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
      />
      <button className="rounded bg-accent px-4 py-2 text-sm text-white" onClick={onSend} disabled={loading} type="button">
        {loading ? "..." : "Send"}
      </button>
    </footer>
  );
}
