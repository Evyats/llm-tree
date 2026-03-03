import { MarkerType, type Edge } from "reactflow";

export const EDGE_TYPE_OPTIONS = [
  { value: "default", label: "Bezier" },
  { value: "straight", label: "Straight" },
  { value: "step", label: "Step" },
] as const;

export const EDGE_MOTION_OPTIONS = [
  { value: "static", label: "Static" },
  { value: "animated", label: "Animated" },
] as const;

export const EDGE_LINE_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
] as const;

export type EdgeTypeValue = (typeof EDGE_TYPE_OPTIONS)[number]["value"];
export type EdgeMotionValue = (typeof EDGE_MOTION_OPTIONS)[number]["value"];
export type EdgeLineStyleValue = (typeof EDGE_LINE_STYLE_OPTIONS)[number]["value"];

export interface EdgeAppearance {
  type: EdgeTypeValue;
  motion: EdgeMotionValue;
  lineStyle: EdgeLineStyleValue;
}

function dashArrayFor(lineStyle: EdgeLineStyleValue): string | undefined {
  if (lineStyle === "dashed") return "8 6";
  if (lineStyle === "dotted") return "2 6";
  return undefined;
}

export function styleEdgeWithAppearance(edge: Edge, appearance: EdgeAppearance): Edge {
  return {
    ...edge,
    type: appearance.type,
    animated: appearance.motion === "animated",
    style: {
      ...(edge.style ?? {}),
      strokeWidth: 2,
      strokeDasharray: dashArrayFor(appearance.lineStyle),
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#176b87",
    },
  };
}
