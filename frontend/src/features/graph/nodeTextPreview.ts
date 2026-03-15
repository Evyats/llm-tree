export const NODE_TEXT_PREVIEW_CHAR_LIMIT = 420;
export const NODE_TEXT_PREVIEW_MAX_HEIGHT_PX = 220;

export function buildNodeDisplayText(text: string, expanded: boolean) {
  const normalized = text ?? "";
  const expandable = normalized.trim().length > NODE_TEXT_PREVIEW_CHAR_LIMIT;
  if (!expandable || expanded) {
    return {
      text: normalized,
      expandable,
    };
  }
  return {
    text: normalized.slice(0, NODE_TEXT_PREVIEW_CHAR_LIMIT).trimEnd(),
    expandable,
  };
}
