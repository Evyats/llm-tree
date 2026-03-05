import type { FitViewOptions } from "reactflow";

export const GRAPH_STORAGE_KEY = "chat-tree:last-graph-id";
export const ROOT_KEY = "__root__";
export const FIXED_X_STEP = 260;
export const FIXED_ROOT_SPREAD = 4;
export const FIXED_MIN_COL_GAP = 36;
export const FIXED_ROW_GAP = 40;
export const FIXED_TREE_GAP = 108;

export const FIT_VIEW_OPTIONS: FitViewOptions = {
  padding: 0.34,
  duration: 280,
  includeHiddenNodes: true,
};

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 2.5;
export const DEFAULT_FIT_VIEW_BUTTON_PADDING = 0.05;
export const ZOOM_BUTTON_FACTOR = 1.75;
export const NODE_ORIGIN_X = 0.5;
export const NODE_ORIGIN_Y = 0;

export const NODE_MIN_WIDTH_DEFAULT = 150;
export const NODE_MAX_WIDTH_DEFAULT = 110;
export const NODE_MAX_WIDTH_UNIT_PX = 4;

export const COLLAPSED_PREVIEW_TEXT_MAX = 42;
