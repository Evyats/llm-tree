import type { NodeData } from "../../store/useGraphStore";

export interface NodeUiCallbacks {
  onCycleVariant?: (nodeId: string, direction: -1 | 1) => void;
  onApproveVariant?: (nodeId: string) => void;
  onSelectElaboration?: (nodeId: string, text: string, occurrence: number, x: number, y: number) => void;
  onOpenPanel?: (nodeId: string) => void;
  onDeleteBranch?: (nodeId: string) => void;
  onExtractPath?: (nodeId: string) => void;
  onCompactBranch?: (nodeId: string) => void;
  onHoverWheelStart?: (nodeId: string) => void;
  onHoverWheelEnd?: (nodeId: string) => void;
  onHoverWheelScroll?: (nodeId: string, deltaY: number, clientX: number, clientY: number) => boolean;
  onToggleContextMenu?: (nodeId: string) => void;
}

export interface NodeUiState {
  panelActive?: boolean;
  contextMenuOpen?: boolean;
  compacting?: boolean;
}

export type GraphNodeUiData = NodeData & NodeUiState & NodeUiCallbacks;
