import { useCallback } from "react";
import type { Node, ReactFlowInstance } from "reactflow";

import { FIT_VIEW_OPTIONS } from "./constants";
import { getExactCenteredViewport, getViewportCenterZoomTarget } from "./viewport";

interface UseViewportControlsParams {
  reactFlowInstance: ReactFlowInstance | null;
  mainElement: HTMLElement | null;
  fitViewPadding: number;
  minZoom: number;
  maxZoom: number;
  nodeOriginX: number;
  nodeOriginY: number;
}

function getCanvasSize(mainElement: HTMLElement | null) {
  if (!mainElement) {
    return { width: 120, height: 120 };
  }
  const flowViewportEl = mainElement.querySelector(".react-flow") as HTMLElement | null;
  const baseWidth = flowViewportEl?.clientWidth ?? mainElement.clientWidth;
  const baseHeight = flowViewportEl?.clientHeight ?? mainElement.clientHeight;
  return {
    width: Math.max(120, baseWidth),
    height: Math.max(120, baseHeight),
  };
}

function getBoundsFromNodes(nodes: Node[], nodeOriginX: number, nodeOriginY: number) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const measuredNode = node as typeof node & { measured?: { width?: number; height?: number } };
    const width = node.width ?? measuredNode.measured?.width ?? 0;
    const height = node.height ?? measuredNode.measured?.height ?? 0;
    if (width <= 0 || height <= 0) continue;
    const left = node.position.x - width * nodeOriginX;
    const top = node.position.y - height * nodeOriginY;
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + width);
    maxY = Math.max(maxY, top + height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function useViewportControls({
  reactFlowInstance,
  mainElement,
  fitViewPadding,
  minZoom,
  maxZoom,
  nodeOriginX,
  nodeOriginY,
}: UseViewportControlsParams) {
  const fitCanvasToGraph = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!reactFlowInstance) return;
        const rfNodes = reactFlowInstance.getNodes().filter((node) => !node.hidden);
        if (rfNodes.length === 0) return;
        const bounds = getBoundsFromNodes(rfNodes, nodeOriginX, nodeOriginY);
        if (!bounds) return;
        const { width, height } = getCanvasSize(mainElement);
        const viewport = getExactCenteredViewport(bounds, width, height, minZoom, maxZoom, fitViewPadding);
        void reactFlowInstance.setViewport(viewport, { duration: FIT_VIEW_OPTIONS.duration ?? 280 });
      });
    });
  }, [fitViewPadding, mainElement, maxZoom, minZoom, nodeOriginX, nodeOriginY, reactFlowInstance]);

  const zoomByFactor = useCallback(
    (factor: number) => {
      if (!reactFlowInstance) return;
      const { width, height } = getCanvasSize(mainElement);
      const viewport = reactFlowInstance.getViewport();
      const desiredZoom = viewport.zoom * factor;
      const nextZoom = Math.max(minZoom, Math.min(maxZoom, desiredZoom));
      const nextViewport = getViewportCenterZoomTarget(reactFlowInstance, width, height, nextZoom);
      void reactFlowInstance.setViewport(nextViewport, { duration: 220 });
    },
    [mainElement, maxZoom, minZoom, reactFlowInstance]
  );

  const centerNodeInView = useCallback(
    (nodeId: string, duration = 560) => {
      if (!reactFlowInstance) return;
      const node = reactFlowInstance.getNode(nodeId);
      if (!node) return;
      const zoom = reactFlowInstance.getZoom();
      const { width, height } = getCanvasSize(mainElement);
      const targetX = width / 2 - node.position.x * zoom;
      const targetY = height * 0.2 - node.position.y * zoom;
      void reactFlowInstance.setViewport(
        {
          x: targetX,
          y: targetY,
          zoom,
        },
        { duration },
      );
    },
    [mainElement, reactFlowInstance],
  );

  return {
    fitCanvasToGraph,
    centerNodeInView,
    zoomIn: (factor: number) => zoomByFactor(factor),
    zoomOut: (factor: number) => zoomByFactor(1 / factor),
  };
}
