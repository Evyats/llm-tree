interface ModelResponseBannerProps {
  tasks: Array<{ id: string; label: string }>;
}

export default function ModelResponseBanner({ tasks }: ModelResponseBannerProps) {
  if (tasks.length === 0) {
    return null;
  }
  return (
    <div className="pointer-events-none absolute left-1/2 top-14 z-[1400] flex w-80 -translate-x-1/2 flex-col gap-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="rounded-md border border-stone-300 bg-paper/95 px-3 py-2 shadow-float backdrop-blur"
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-700">
            Waiting For LLM Response
          </div>
          <div className="mb-1 text-xs text-stone-600">{task.label}</div>
          <div className="flex items-center gap-1.5 text-stone-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent/70 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent/70 [animation-delay:120ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent/70 [animation-delay:240ms]" />
          </div>
        </div>
      ))}
    </div>
  );
}
