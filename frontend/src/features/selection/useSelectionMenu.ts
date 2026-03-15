import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ElaborateAction,
  SELECTION_MENU_OPEN_DELAY_MS,
  buildSelectionMenuCandidate,
} from "./menu";

export function useSelectionMenu() {
  const [elaborateAction, setElaborateAction] = useState<ElaborateAction | null>(null);
  const preservedSelectionRangeRef = useRef<Range | null>(null);
  const selectionMenuTimerRef = useRef<number | null>(null);

  const clearElaborateAction = useCallback(() => {
    preservedSelectionRangeRef.current = null;
    setElaborateAction(null);
  }, []);

  useEffect(() => {
    if (!elaborateAction || !preservedSelectionRangeRef.current) {
      return;
    }
    const range = preservedSelectionRangeRef.current;
    const raf = requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      selection.removeAllRanges();
      selection.addRange(range);
    });
    return () => cancelAnimationFrame(raf);
  }, [elaborateAction]);

  useEffect(() => {
    const clearPendingSelectionMenu = () => {
      if (selectionMenuTimerRef.current !== null) {
        window.clearTimeout(selectionMenuTimerRef.current);
        selectionMenuTimerRef.current = null;
      }
    };

    const scheduleSelectionMenu = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest('[data-selection-menu="true"]') ||
          target.closest("input, textarea, [contenteditable='true'], [contenteditable='']"))
      ) {
        return;
      }
      clearPendingSelectionMenu();
      requestAnimationFrame(() => {
        const candidate = buildSelectionMenuCandidate();
        if (!candidate) {
          return;
        }
        preservedSelectionRangeRef.current = candidate.range;
        requestAnimationFrame(() => {
          const selection = window.getSelection();
          if (!selection) {
            return;
          }
          selection.removeAllRanges();
          selection.addRange(candidate.range);
        });
        selectionMenuTimerRef.current = window.setTimeout(() => {
          setElaborateAction({
            nodeId: candidate.nodeId,
            role: candidate.role,
            text: candidate.text,
            occurrence: candidate.occurrence,
            x: candidate.x,
            y: candidate.y,
          });
          selectionMenuTimerRef.current = null;
        }, SELECTION_MENU_OPEN_DELAY_MS);
      });
    };

    document.addEventListener("mouseup", scheduleSelectionMenu, true);
    return () => {
      document.removeEventListener("mouseup", scheduleSelectionMenu, true);
      clearPendingSelectionMenu();
    };
  }, []);

  return {
    elaborateAction,
    setElaborateAction,
    clearElaborateAction,
  };
}
