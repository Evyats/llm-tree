import type { ReactFlowInstance } from "reactflow";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getExactCenteredViewport(
  bounds: Bounds,
  viewportWidth: number,
  viewportHeight: number,
  minZoom: number,
  maxZoom: number,
  padding: number
) {
  const safeWidth = Math.max(1, bounds.width);
  const safeHeight = Math.max(1, bounds.height);
  const scaleX = viewportWidth / (safeWidth * (1 + padding * 2));
  const scaleY = viewportHeight / (safeHeight * (1 + padding * 2));
  const zoom = Math.max(minZoom, Math.min(maxZoom, Math.min(scaleX, scaleY)));
  const centerX = bounds.x + safeWidth / 2;
  const centerY = bounds.y + safeHeight / 2;
  return {
    x: viewportWidth / 2 - centerX * zoom,
    y: viewportHeight / 2 - centerY * zoom,
    zoom,
  };
}

export function getViewportCenterZoomTarget(
  reactFlowInstance: ReactFlowInstance,
  containerWidth: number,
  containerHeight: number,
  nextZoom: number
) {
  const viewport = reactFlowInstance.getViewport();
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  const flowCenterX = (centerX - viewport.x) / viewport.zoom;
  const flowCenterY = (centerY - viewport.y) / viewport.zoom;
  const nextX = centerX - flowCenterX * nextZoom;
  const nextY = centerY - flowCenterY * nextZoom;
  return { x: nextX, y: nextY, zoom: nextZoom };
}
