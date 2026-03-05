interface WheelModeBannerProps {
  visible: boolean;
  active: boolean;
  holdMs: number;
  progress: number;
}

export default function WheelModeBanner({ visible, active, holdMs, progress }: WheelModeBannerProps) {
  if (!visible) {
    return null;
  }
  return (
    <div className="pointer-events-none absolute left-1/2 top-14 z-[1400] w-72 -translate-x-1/2 rounded-md border border-stone-300 bg-paper/95 px-3 py-1 shadow-float backdrop-blur">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-700">
        {active ? "Wheel Mode Active" : `Hold To Enable Wheel Mode (${(holdMs / 1000).toFixed(1)}s)`}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
        <div
          className={`h-full rounded-full ${active ? "bg-accent" : "bg-stone-500"}`}
          style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
        />
      </div>
    </div>
  );
}

