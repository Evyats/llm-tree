interface AppHeaderProps {
  title: string;
  responseSource: "live" | "fallback" | null;
  apiKeyInput: string;
  onApiKeyInputChange: (value: string) => void;
  onSaveApiKey: () => void;
  onNewChat: () => void;
}

export default function AppHeader({
  title,
  responseSource,
  apiKeyInput,
  onApiKeyInputChange,
  onSaveApiKey,
  onNewChat,
}: AppHeaderProps) {
  return (
    <header className="absolute left-0 top-0 z-20 flex w-full items-center justify-between gap-3 border-b border-stone-300 bg-paper/85 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold">{title}</h1>
        {responseSource && <span className="rounded bg-stone-100 px-2 py-1 text-xs">source: {responseSource}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button className="rounded bg-stone-800 px-3 py-1 text-xs text-white" onClick={onNewChat} type="button">
          New Chat
        </button>
        <input
          className="w-64 rounded border border-stone-300 px-2 py-1 text-xs"
          placeholder="Optional session OpenAI key"
          type="password"
          value={apiKeyInput}
          onChange={(event) => onApiKeyInputChange(event.target.value)}
        />
        <button className="rounded bg-accent px-3 py-1 text-xs text-white" onClick={onSaveApiKey} type="button">
          Save Key
        </button>
      </div>
    </header>
  );
}
