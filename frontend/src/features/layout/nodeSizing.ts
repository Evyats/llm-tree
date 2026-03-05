import type { NodeData } from "../../store/useGraphStore";

type Role = NodeData["role"];

interface RoleSizingConfig {
  minWidth: number;
  maxWidth: number;
  widthStepChars: number;
  widthStepPx: number;
  horizontalPadding: number;
  minHeight: number;
  lineHeight: number;
  headerHeight: number;
}

const SHARED_ROLE_SIZING: RoleSizingConfig = {
  minWidth: 190,
  maxWidth: 460,
  widthStepChars: 5,
  widthStepPx: 8,
  horizontalPadding: 32,
  minHeight: 86,
  lineHeight: 22,
  headerHeight: 34,
};

export const DEFAULT_ROLE_SIZING: Record<Role, RoleSizingConfig> = {
  assistant: { ...SHARED_ROLE_SIZING },
  user: { ...SHARED_ROLE_SIZING },
};

let runtimeRoleSizing: Record<Role, RoleSizingConfig> = {
  assistant: { ...DEFAULT_ROLE_SIZING.assistant },
  user: { ...DEFAULT_ROLE_SIZING.user },
};

export interface NodeSizingRuntimePatch {
  assistant?: Partial<RoleSizingConfig>;
  user?: Partial<RoleSizingConfig>;
}

interface EstimateNodeFrameOptions {
  forceMinContentWidth?: number;
  extraMinWidth?: number;
}

export function setNodeSizingRuntime(patch: NodeSizingRuntimePatch) {
  runtimeRoleSizing = {
    assistant: { ...runtimeRoleSizing.assistant, ...(patch.assistant ?? {}) },
    user: { ...runtimeRoleSizing.user, ...(patch.user ?? {}) },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizedLength(text: string): number {
  return text.replace(/\r/g, "").length;
}

function estimateLineCount(text: string, contentWidth: number): number {
  const charsPerLine = Math.max(14, Math.floor(contentWidth / 7.6));
  const linesByWrap = Math.ceil(Math.max(1, normalizedLength(text)) / charsPerLine);
  const linesByBreaks = text.split(/\n/).length;
  return Math.max(1, linesByWrap, linesByBreaks);
}

export function estimateNodeFrame(role: Role, text: string, options?: EstimateNodeFrameOptions) {
  const config = runtimeRoleSizing[role];
  const length = normalizedLength(text);
  const widthSteps = Math.floor(length / Math.max(1, config.widthStepChars));
  const effectiveMinWidth = Math.max(80, config.minWidth + (options?.extraMinWidth ?? 0));
  const width = clamp(effectiveMinWidth + widthSteps * config.widthStepPx, effectiveMinWidth, config.maxWidth);
  const contentWidth = Math.max(options?.forceMinContentWidth ?? 120, width - config.horizontalPadding);
  const lines = estimateLineCount(text, contentWidth);
  const estimatedHeight = Math.max(config.minHeight, config.headerHeight + lines * config.lineHeight);
  return {
    width,
    contentWidth,
    minHeight: config.minHeight,
    estimatedHeight,
  };
}
