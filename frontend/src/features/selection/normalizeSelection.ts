function isWordChar(char: string): boolean {
  return /[\p{L}\p{N}_]/u.test(char);
}

function getTextOffset(root: HTMLElement, node: Node, offset: number): number | null {
  if (node !== root && !root.contains(node)) {
    return null;
  }
  const range = document.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(node, offset);
  } catch {
    return null;
  }
  return range.toString().length;
}

export function normalizeSelectionToWordBoundaries(selection: Selection, root: HTMLElement): string | null {
  if (selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) {
    return null;
  }

  const fullText = root.textContent ?? "";
  if (!fullText) {
    return null;
  }

  const rawStart = getTextOffset(root, range.startContainer, range.startOffset);
  const rawEnd = getTextOffset(root, range.endContainer, range.endOffset);
  if (rawStart === null || rawEnd === null) {
    const fallback = selection.toString().trim();
    return fallback || null;
  }

  let start = Math.max(0, Math.min(rawStart, rawEnd));
  let end = Math.min(fullText.length, Math.max(rawStart, rawEnd));
  if (start >= end) {
    return null;
  }

  while (start > 0 && isWordChar(fullText[start - 1] ?? "")) {
    start -= 1;
  }
  while (end < fullText.length && isWordChar(fullText[end] ?? "")) {
    end += 1;
  }

  const normalized = fullText.slice(start, end).trim();
  return normalized || null;
}

