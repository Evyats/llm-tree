import type { FitViewOptions } from "reactflow";

export const GRAPH_STORAGE_KEY = "chat-tree:last-graph-id";
export const ROOT_KEY = "__root__";
export const FIXED_X_STEP = 260;
export const FIXED_ROOT_SPREAD = 4;
export const FIXED_MIN_COL_GAP = 36;
export const FIXED_ROW_GAP = 26;
export const FIXED_TREE_GAP = 108;

export const FIT_VIEW_OPTIONS: FitViewOptions = {
  padding: 0.34,
  duration: 280,
  includeHiddenNodes: true,
};
