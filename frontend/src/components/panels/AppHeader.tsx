interface AppHeaderProps {
  title: string;
  responseSource: "live" | "fallback" | null;
  apiKeyInput: string;
  onApiKeyInputChange: (value: string) => void;
  onSaveApiKey: () => void;
  onNewChat: () => void;
  modelOptions: string[];
  selectedModel: string;
  onSelectedModelChange: (value: string) => void;
  onToggleHistory?: () => void;
}

export default function AppHeader({
  title,
  responseSource,
  apiKeyInput,
  onApiKeyInputChange,
  onSaveApiKey,
  onNewChat,
  modelOptions,
  selectedModel,
  onSelectedModelChange,
  onToggleHistory,
}: AppHeaderProps) {
  return (
    <header className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-stone-300 bg-paper/85 px-3 py-2 backdrop-blur md:flex-nowrap md:px-4">
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        {onToggleHistory && (
          <button
            className="rounded bg-stone-200 px-2 py-1 text-xs text-stone-700 md:hidden"
            onClick={onToggleHistory}
            type="button"
            aria-label="Open chat history"
            title="Open chat history"
          >
            Chats
          </button>
        )}
        <h1 className="text-sm font-semibold">{title}</h1>
        {responseSource && <span className="rounded bg-stone-100 px-2 py-1 text-xs">source: {responseSource}</span>}
      </div>
      <div className="flex w-full items-center gap-2 md:w-auto">
        <button className="rounded bg-stone-800 px-3 py-1 text-xs text-white" onClick={onNewChat} type="button">
          New Chat
        </button>
        <select
          className="min-w-0 rounded border border-stone-300 bg-white px-2 py-1 text-xs md:w-44"
          value={selectedModel}
          onChange={(event) => onSelectedModelChange(event.target.value)}
          title="Response model"
        >
          <option value="fallback">Default (Fallback)</option>
          {modelOptions.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        <input
          className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-xs md:w-64 md:flex-none"
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
