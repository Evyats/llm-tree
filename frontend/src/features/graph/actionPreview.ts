export type ActionPreviewStyle = "outline" | "glow" | "wash";
export type ActionPreviewKind = "context" | "delete" | "extract" | "compact";

export function getActionPreviewClasses(active: boolean, style: ActionPreviewStyle): string {
  if (!active) {
    return "";
  }
  switch (style) {
    case "glow":
      return "ring-2 ring-accent/70 shadow-[0_0_0_4px_rgba(23,107,135,0.14),0_0_26px_rgba(23,107,135,0.18)]";
    case "wash":
      return "border-accent bg-[linear-gradient(135deg,rgba(23,107,135,0.12),rgba(255,255,255,0.92))]";
    case "outline":
    default:
      return "ring-2 ring-accent/65 ring-offset-2 ring-offset-[#f6f3ea] border-accent";
  }
}
