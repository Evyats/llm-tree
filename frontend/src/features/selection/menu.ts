import { normalizeSelectionToWordBoundariesDetailed } from "./normalizeSelection";

export interface ElaborateAction {
  nodeId: string;
  role: "user" | "assistant";
  text: string;
  occurrence: number;
  x: number;
  y: number;
}

export interface SelectionMenuCandidate extends ElaborateAction {
  range: Range;
}

export const SELECTION_MENU_OPEN_DELAY_MS = 60;

export function findSelectionTextRoot(node: globalThis.Node | null): HTMLElement | null {
  if (!node) {
    return null;
  }
  if (node instanceof HTMLElement && node.matches('[data-node-text-content="true"]')) {
    return node;
  }
  return node.parentElement?.closest('[data-node-text-content="true"]') ?? null;
}

export function buildSelectionMenuCandidate(): SelectionMenuCandidate | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const anchorRoot = findSelectionTextRoot(selection.anchorNode);
  const focusRoot = findSelectionTextRoot(selection.focusNode);
  if (!anchorRoot || anchorRoot !== focusRoot) {
    return null;
  }
  const nodeId = anchorRoot.dataset.nodeId;
  const role = anchorRoot.dataset.nodeRole;
  if (!nodeId || (role !== "assistant" && role !== "user")) {
    return null;
  }
  const normalized = normalizeSelectionToWordBoundariesDetailed(selection, anchorRoot);
  if (!normalized) {
    return null;
  }
  const range = selection.getRangeAt(0).cloneRange();
  const rect = range.getBoundingClientRect();
  const clientRect = rect.width > 0 || rect.height > 0 ? rect : range.getClientRects()[0];
  if (!clientRect) {
    return null;
  }
  return {
    nodeId,
    role,
    text: normalized.text,
    occurrence: normalized.occurrence,
    x: clientRect.left + clientRect.width / 2,
    y: clientRect.top,
    range,
  };
}
