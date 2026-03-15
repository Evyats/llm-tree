import type { NodeData } from "../../store/useGraphStore";
import type { ActionPreviewKind, ActionPreviewStyle } from "./actionPreview";

export interface NodeUiCallbacks {
  onCycleVariant?: (nodeId: string, direction: -1 | 1) => void;
  onApproveVariant?: (nodeId: string) => void;
  onOpenPanel?: (nodeId: string) => void;
  onDeleteBranch?: (nodeId: string) => void;
  onExtractPath?: (nodeId: string) => void;
  onCompactBranch?: (nodeId: string) => void;
  onHoverWheelStart?: (nodeId: string) => void;
  onHoverWheelEnd?: (nodeId: string) => void;
  onHoverWheelScroll?: (nodeId: string, deltaY: number, clientX: number, clientY: number) => boolean;
  onToggleContextMenu?: (nodeId: string) => void;
  onActionPreviewStart?: (nodeId: string, action: ActionPreviewKind) => void;
  onActionPreviewEnd?: () => void;
  onToggleExpandedText?: (nodeId: string) => void;
}

export interface NodeUiState {
  panelActive?: boolean;
  contextMenuOpen?: boolean;
  compacting?: boolean;
  actionPreviewActive?: boolean;
  actionPreviewStyle?: ActionPreviewStyle;
  displayText?: string;
  textExpandable?: boolean;
  textExpanded?: boolean;
}

export type GraphNodeUiData = NodeData & NodeUiState & NodeUiCallbacks;
