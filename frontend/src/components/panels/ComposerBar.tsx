import type { RefObject } from "react";

interface ComposerBarProps {
  selectedNodeId: string | null;
  composerText: string;
  loading: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  onComposerTextChange: (value: string) => void;
  onSend: () => void;
}

export default function ComposerBar({
  selectedNodeId,
  composerText,
  loading,
  inputRef,
  onComposerTextChange,
  onSend,
}: ComposerBarProps) {
  return (
    <footer className="absolute bottom-0 left-0 z-20 flex w-full items-center gap-2 border-t border-stone-300 bg-paper/90 px-3 py-2 pl-[16.6rem] backdrop-blur">
      <div className="rounded bg-stone-100 px-2 py-1 text-xs">selected: {selectedNodeId ?? "none"}</div>
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
