import {
  EDGE_LINE_STYLE_OPTIONS,
  EDGE_MOTION_OPTIONS,
  EDGE_TYPE_OPTIONS,
  type EdgeLineStyleValue,
  type EdgeMotionValue,
  type EdgeTypeValue,
} from "../../features/graph/edgeStyles";
import { type ActionPreviewStyle } from "../../features/graph/actionPreview";
import { DEFAULT_ROLE_SIZING } from "../../features/layout/nodeSizing";
import type { LayoutSliderTab } from "../../features/layout/types";

interface LayoutControlsPanelProps {
  visible: boolean;
  position: { left: number; top: number };
  tab: LayoutSliderTab;
  setTab: (tab: LayoutSliderTab) => void;
  onClose: () => void;
  rowGap: number;
  setRowGap: (value: number) => void;
  rowGapDefault: number;
  siblingGap: number;
  setSiblingGap: (value: number) => void;
  siblingGapDefault: number;
  treeGap: number;
  setTreeGap: (value: number) => void;
  treeGapDefault: number;
  fitViewPadding: number;
  setFitViewPadding: (value: number) => void;
  fitViewPaddingDefault: number;
  assistantWheelHoldMs: number;
  setAssistantWheelHoldMs: (value: number) => void;
  assistantWheelHoldDefault: number;
  fallbackDelayMs: number;
  setFallbackDelayMs: (value: number) => void;
  fallbackDelayDefault: number;
  nodeMinWidth: number;
  setNodeMinWidth: (value: number) => void;
  nodeMinWidthDefault: number;
  nodeMaxWidth: number;
  setNodeMaxWidth: (value: number) => void;
  nodeMaxWidthDefault: number;
  nodeMaxWidthUnitPx: number;
  nodeStepChars: number;
  setNodeStepChars: (value: number) => void;
  nodeStepPx: number;
  setNodeStepPx: (value: number) => void;
  userEdgeType: EdgeTypeValue;
  setUserEdgeType: (value: EdgeTypeValue) => void;
  userEdgeMotion: EdgeMotionValue;
  setUserEdgeMotion: (value: EdgeMotionValue) => void;
  userEdgeLineStyle: EdgeLineStyleValue;
  setUserEdgeLineStyle: (value: EdgeLineStyleValue) => void;
  assistantEdgeType: EdgeTypeValue;
  setAssistantEdgeType: (value: EdgeTypeValue) => void;
  assistantEdgeMotion: EdgeMotionValue;
  setAssistantEdgeMotion: (value: EdgeMotionValue) => void;
  assistantEdgeLineStyle: EdgeLineStyleValue;
  setAssistantEdgeLineStyle: (value: EdgeLineStyleValue) => void;
  actionPreviewStyle: ActionPreviewStyle;
  setActionPreviewStyle: (value: ActionPreviewStyle) => void;
  showCanvasGrid: boolean;
  setShowCanvasGrid: (value: boolean) => void;
}

export default function LayoutControlsPanel({
  visible,
  position,
  tab,
  setTab,
  onClose,
  rowGap,
  setRowGap,
  rowGapDefault,
  siblingGap,
  setSiblingGap,
  siblingGapDefault,
  treeGap,
  setTreeGap,
  treeGapDefault,
  fitViewPadding,
  setFitViewPadding,
  fitViewPaddingDefault,
  assistantWheelHoldMs,
  setAssistantWheelHoldMs,
  assistantWheelHoldDefault,
  fallbackDelayMs,
  setFallbackDelayMs,
  fallbackDelayDefault,
  nodeMinWidth,
  setNodeMinWidth,
  nodeMinWidthDefault,
  nodeMaxWidth,
  setNodeMaxWidth,
  nodeMaxWidthDefault,
  nodeMaxWidthUnitPx,
  nodeStepChars,
  setNodeStepChars,
  nodeStepPx,
  setNodeStepPx,
  userEdgeType,
  setUserEdgeType,
  userEdgeMotion,
  setUserEdgeMotion,
  userEdgeLineStyle,
  setUserEdgeLineStyle,
  assistantEdgeType,
  setAssistantEdgeType,
  assistantEdgeMotion,
  setAssistantEdgeMotion,
  assistantEdgeLineStyle,
  setAssistantEdgeLineStyle,
  actionPreviewStyle,
  setActionPreviewStyle,
  showCanvasGrid,
  setShowCanvasGrid,
}: LayoutControlsPanelProps) {
  if (!visible) return null;

  return (
    <div
      className="absolute z-[1000] w-[18rem] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-lg border border-stone-300 bg-paper/95 p-2 backdrop-blur pointer-events-auto"
      style={{ left: position.left, top: position.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">Layout Controls</div>
        <button
          className="rounded bg-stone-200 p-1 text-stone-700 hover:bg-stone-300"
          onClick={onClose}
          type="button"
          aria-label="Close layout controls"
          title="Close"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5L15 15M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="mb-2 text-[10px] text-stone-500">Double-click any slider to reset to default.</div>
      <div className="space-y-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1 rounded bg-stone-100 p-1">
            {([
              ["spacing", "Spacing"],
              ["sizing", "Node Sizing"],
              ["view", "View"],
              ["userArrows", "User Arrows"],
              ["assistantArrows", "Assistant Arrows"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`rounded px-2 py-1 text-[11px] ${
                  tab === key ? "bg-white text-accent shadow-sm" : "text-stone-700 hover:bg-stone-200"
                }`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "spacing" && (
            <>
              <label className="block text-[11px] text-stone-700">
                Row gap: <span className="font-semibold">{rowGap}</span>
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={20}
                  max={240}
                  step={2}
                  value={rowGap}
                  onChange={(event) => setRowGap(Number(event.target.value))}
                  onDoubleClick={() => setRowGap(rowGapDefault)}
                  title="Double-click to reset"
                />
              </label>
              <label className="block text-[11px] text-stone-700">
                Sibling gap: <span className="font-semibold">{siblingGap}</span>
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0}
                  max={240}
                  step={2}
                  value={siblingGap}
                  onChange={(event) => setSiblingGap(Number(event.target.value))}
                  onDoubleClick={() => setSiblingGap(siblingGapDefault)}
                  title="Double-click to reset"
                />
              </label>
              <label className="block text-[11px] text-stone-700">
                Tree gap: <span className="font-semibold">{treeGap}</span>
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={20}
                  max={420}
                  step={2}
                  value={treeGap}
                  onChange={(event) => setTreeGap(Number(event.target.value))}
                  onDoubleClick={() => setTreeGap(treeGapDefault)}
                  title="Double-click to reset"
                />
              </label>
            </>
          )}
          {tab === "view" && (
            <>
              <label className="block text-[11px] text-stone-700">
                Fit padding: <span className="font-semibold">{fitViewPadding.toFixed(2)}</span>
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0}
                  max={1.2}
                  step={0.02}
                  value={fitViewPadding}
                  onChange={(event) => setFitViewPadding(Number(event.target.value))}
                  onDoubleClick={() => setFitViewPadding(fitViewPaddingDefault)}
                  title="Double-click to reset"
                />
              </label>
              <label className="block text-[11px] text-stone-700">
                Wheel hold (s): <span className="font-semibold">{(assistantWheelHoldMs / 1000).toFixed(1)}</span>
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0}
                  max={5000}
                  step={100}
                  value={assistantWheelHoldMs}
                  onChange={(event) => setAssistantWheelHoldMs(Number(event.target.value))}
                  onDoubleClick={() => setAssistantWheelHoldMs(assistantWheelHoldDefault)}
                  title="Double-click to reset"
                />
              </label>
              <label className="block text-[11px] text-stone-700">
                Fallback delay (s): <span className="font-semibold">{(fallbackDelayMs / 1000).toFixed(1)}</span>
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0}
                  max={10000}
                  step={100}
                  value={fallbackDelayMs}
                  onChange={(event) => setFallbackDelayMs(Number(event.target.value))}
                  onDoubleClick={() => setFallbackDelayMs(fallbackDelayDefault)}
                  title="Double-click to reset"
                />
              </label>
              <div className="pt-1">
                <div className="mb-2 flex items-center justify-between rounded border border-stone-200 bg-white/70 px-2 py-1.5">
                  <div className="text-[11px] text-stone-700">
                    Canvas grid: <span className="font-semibold">{showCanvasGrid ? "On" : "Off"}</span>
                  </div>
                  <button
                    type="button"
                    className={`rounded px-2 py-1 text-[10px] leading-none ${
                      showCanvasGrid
                        ? "border border-accent/40 bg-accent/20 text-accent"
                        : "border border-transparent bg-stone-200 text-stone-700 hover:bg-stone-300"
                    }`}
                    onClick={() => setShowCanvasGrid(!showCanvasGrid)}
                  >
                    Toggle
                  </button>
                </div>
                <div className="mb-1 text-[11px] text-stone-700">
                  Action hover preview: <span className="font-semibold capitalize">{actionPreviewStyle}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {([
                    ["outline", "Outline"],
                    ["glow", "Glow"],
                    ["wash", "Wash"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={`action-preview-${value}`}
                      type="button"
                      className={`rounded px-2 py-1 text-[10px] leading-none ${
                        actionPreviewStyle === value
                          ? "border border-accent/40 bg-accent/20 text-accent"
                          : "border border-transparent bg-stone-200 text-stone-700 hover:bg-stone-300"
                      }`}
                      onClick={() => setActionPreviewStyle(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {tab === "sizing" && (
            <>
              <label className="block text-[11px] text-stone-700">
                Min width: <span className="font-semibold">{nodeMinWidth}</span>
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={150}
                  max={600}
                  step={5}
                  value={nodeMinWidth}
                  onChange={(event) => setNodeMinWidth(Number(event.target.value))}
                  onDoubleClick={() => setNodeMinWidth(nodeMinWidthDefault)}
                  title="Double-click to reset"
                />
              </label>
              <label className="block text-[11px] text-stone-700">
                Max width:{" "}
                <span className="font-semibold">
                  {nodeMaxWidth} ({nodeMaxWidth * nodeMaxWidthUnitPx}px)
                </span>
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={20}
                  max={120}
                  step={1}
                  value={nodeMaxWidth}
                  onChange={(event) => setNodeMaxWidth(Number(event.target.value))}
                  onDoubleClick={() => setNodeMaxWidth(nodeMaxWidthDefault)}
                  title="Double-click to reset"
                />
              </label>
              <label className="block text-[11px] text-stone-700">
                Width step chars: <span className="font-semibold">{nodeStepChars}</span>
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={nodeStepChars}
                  onChange={(event) => setNodeStepChars(Number(event.target.value))}
                  onDoubleClick={() => setNodeStepChars(DEFAULT_ROLE_SIZING.assistant.widthStepChars)}
                  title="Double-click to reset"
                />
              </label>
              <label className="block text-[11px] text-stone-700">
                Width step px: <span className="font-semibold">{nodeStepPx}</span>
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={1}
                  max={24}
                  step={1}
                  value={nodeStepPx}
                  onChange={(event) => setNodeStepPx(Number(event.target.value))}
                  onDoubleClick={() => setNodeStepPx(DEFAULT_ROLE_SIZING.assistant.widthStepPx)}
                  title="Double-click to reset"
                />
              </label>
            </>
          )}
          {tab === "userArrows" && (
            <div className="space-y-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-600">User Outgoing Arrows</div>
              <div className="mb-1 text-[10px] text-stone-500">Type</div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {EDGE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={`user-type-${option.value}`}
                    type="button"
                    className={`rounded px-1.5 py-0.5 text-[10px] leading-none ${
                      userEdgeType === option.value
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                    }`}
                    onClick={() => setUserEdgeType(option.value)}
                    title={option.label}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mb-1 text-[10px] text-stone-500">Motion</div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {EDGE_MOTION_OPTIONS.map((option) => (
                  <button
                    key={`user-motion-${option.value}`}
                    type="button"
                    className={`rounded px-1.5 py-0.5 text-[10px] leading-none ${
                      userEdgeMotion === option.value
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                    }`}
                    onClick={() => setUserEdgeMotion(option.value)}
                    title={option.label}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mb-1 text-[10px] text-stone-500">Line Style</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {EDGE_LINE_STYLE_OPTIONS.map((option) => (
                  <button
                    key={`user-line-${option.value}`}
                    type="button"
                    className={`rounded px-1.5 py-0.5 text-[10px] leading-none ${
                      userEdgeLineStyle === option.value
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                    }`}
                    onClick={() => setUserEdgeLineStyle(option.value)}
                    title={option.label}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab === "assistantArrows" && (
            <div className="space-y-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-600">Assistant Outgoing Arrows</div>
              <div className="mb-1 text-[10px] text-stone-500">Type</div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {EDGE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={`assistant-type-${option.value}`}
                    type="button"
                    className={`rounded px-1.5 py-0.5 text-[10px] leading-none ${
                      assistantEdgeType === option.value
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                    }`}
                    onClick={() => setAssistantEdgeType(option.value)}
                    title={option.label}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mb-1 text-[10px] text-stone-500">Motion</div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {EDGE_MOTION_OPTIONS.map((option) => (
                  <button
                    key={`assistant-motion-${option.value}`}
                    type="button"
                    className={`rounded px-1.5 py-0.5 text-[10px] leading-none ${
                      assistantEdgeMotion === option.value
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                    }`}
                    onClick={() => setAssistantEdgeMotion(option.value)}
                    title={option.label}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mb-1 text-[10px] text-stone-500">Line Style</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {EDGE_LINE_STYLE_OPTIONS.map((option) => (
                  <button
                    key={`assistant-line-${option.value}`}
                    type="button"
                    className={`rounded px-1.5 py-0.5 text-[10px] leading-none ${
                      assistantEdgeLineStyle === option.value
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-stone-200 text-stone-700 border border-transparent hover:bg-stone-300"
                    }`}
                    onClick={() => setAssistantEdgeLineStyle(option.value)}
                    title={option.label}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

