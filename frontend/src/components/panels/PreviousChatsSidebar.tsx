import type { ChatSummary } from "../../api/types";

interface PreviousChatsSidebarProps {
  graphId: string | null;
  chats: ChatSummary[];
  onSelect: (graphId: string) => void;
  onRename: (chat: ChatSummary) => void;
  onAutoRename: (chat: ChatSummary) => void;
  autoRenamingChatIds: Set<string>;
  onDelete: (chat: ChatSummary) => void;
  onDeleteAll: () => void;
  onClose?: () => void;
}

export default function PreviousChatsSidebar({
  graphId,
  chats,
  onSelect,
  onRename,
  onAutoRename,
  autoRenamingChatIds,
  onDelete,
  onDeleteAll,
  onClose,
}: PreviousChatsSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-stone-300 bg-paper/92 p-2 backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-600">Previous Chats</div>
        <div className="flex items-center gap-1">
          <button
            className="rounded bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-200"
            onClick={onDeleteAll}
            type="button"
          >
            Remove All
          </button>
          {onClose && (
            <button
              className="rounded bg-stone-200 p-1 text-stone-700 hover:bg-stone-300"
              onClick={onClose}
              type="button"
              aria-label="Close chat history"
              title="Close"
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5L15 15M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {chats.length === 0 ? (
          <div className="rounded border border-stone-200 bg-white px-2 py-2 text-xs text-stone-500">No saved chats yet.</div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.graph_id}
              className={`w-full cursor-pointer rounded border px-2 py-2 text-left text-xs ${
                graphId === chat.graph_id ? "border-accent bg-accent/10" : "border-stone-200 bg-white hover:bg-stone-50"
              }`}
              onClick={() => onSelect(chat.graph_id)}
            >
              {(() => {
                const autoRenaming = autoRenamingChatIds.has(chat.graph_id);
                return (
                  <>
              <div className="truncate font-medium">{chat.title || "Untitled Chat"}</div>
              <div className="mt-1 truncate text-[10px] text-stone-500">{new Date(chat.updated_at).toLocaleString()}</div>
              <div className={`mt-2 flex items-center gap-2 ${autoRenaming ? "opacity-55" : ""}`}>
                <button
                  className="rounded bg-amber-100 px-2 py-1 text-[10px] text-amber-800 hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAutoRename(chat);
                  }}
                  type="button"
                  disabled={autoRenaming}
                  aria-label="Auto name chat"
                  title="Auto name chat"
                >
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M10 3l1.6 3.9L16 8.5l-3.3 2.8 1 4.2L10 13.3 6.3 15.5l1-4.2L4 8.5l4.4-1.6L10 3Z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  className="rounded bg-stone-200 px-2 py-1 text-[10px] text-stone-700 hover:bg-stone-300 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRename(chat);
                  }}
                  type="button"
                  disabled={autoRenaming}
                  aria-label="Rename chat"
                  title="Rename chat"
                >
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 13.5V16h2.5L14.9 7.6l-2.5-2.5L4 13.5Z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M11.8 5.2l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  className="rounded bg-red-100 px-2 py-1 text-[10px] text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(chat);
                  }}
                  type="button"
                  disabled={autoRenaming}
                  aria-label="Remove chat"
                  title="Remove chat"
                >
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4.5 6h11" strokeLinecap="round" />
                    <path d="M7.5 6V4.8c0-.44.36-.8.8-.8h3.4c.44 0 .8.36.8.8V6" strokeLinecap="round" />
                    <path d="M6.8 6l.7 9.1c.04.49.44.87.93.87h3.2c.49 0 .89-.38.93-.87L13.2 6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
                  </>
                );
              })()}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
