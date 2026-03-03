interface TranscriptLine {
  role: string;
  content: string;
}

interface ContextPanelProps {
  open: boolean;
  transcript: TranscriptLine[];
  panelText: string;
  onClose: () => void;
  onPanelTextChange: (value: string) => void;
  onSend: () => void;
}

export default function ContextPanel({
  open,
  transcript,
  panelText,
  onClose,
  onPanelTextChange,
  onSend,
}: ContextPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <aside className="h-full w-full border-l border-stone-300 bg-paper/95 p-3 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Context Chat</h2>
        <button
          className="rounded bg-stone-200 p-1.5 text-stone-700 hover:bg-stone-300"
          onClick={onClose}
          type="button"
          aria-label="Close context chat"
          title="Close"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5L15 15M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="mb-3 h-[calc(100%-5rem)] overflow-auto rounded border border-stone-300 bg-white p-2">
        {transcript.length === 0 ? (
          <p className="text-xs text-stone-500">Select a node and continue to populate context.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {transcript.map((line, index) => (
              <div key={`${line.role}-${index}`} className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    line.role === "user"
                      ? "rounded-br-md bg-accent text-white"
                      : "rounded-bl-md border border-stone-200 bg-stone-50 text-ink"
                  }`}
                >
                  <div
                    className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${
                      line.role === "user" ? "text-blue-100" : "text-stone-500"
                    }`}
                  >
                    {line.role}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{line.content}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm"
          value={panelText}
          onChange={(event) => onPanelTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Continue from selected node..."
        />
        <button className="rounded bg-accent px-3 py-1 text-sm text-white" onClick={onSend} type="button">
          Send
        </button>
      </div>
    </aside>
  );
}
