interface ModelResponseBannerProps {
  visible: boolean;
}

export default function ModelResponseBanner({ visible }: ModelResponseBannerProps) {
  if (!visible) {
    return null;
  }
  return (
    <div className="pointer-events-none absolute left-1/2 top-14 z-[1400] w-72 -translate-x-1/2 rounded-md border border-stone-300 bg-paper/95 px-3 py-2 shadow-float backdrop-blur">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-700">
        Waiting For Model Response
      </div>
      <div className="flex items-center gap-1.5 text-stone-600">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent/70 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent/70 [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent/70 [animation-delay:240ms]" />
      </div>
    </div>
  );
}

