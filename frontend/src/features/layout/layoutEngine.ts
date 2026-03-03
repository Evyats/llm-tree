import type { Node } from "reactflow";

import type { NodeData } from "../../store/useGraphStore";
import {
  FIXED_MIN_COL_GAP,
  FIXED_ROOT_SPREAD,
  FIXED_ROW_GAP,
  FIXED_TREE_GAP,
  FIXED_X_STEP,
  ROOT_KEY,
} from "./constants";

interface StructureMeta {
  layer: number;
  siblingOrder: number;
  baseX: number;
  rootId: string;
}

interface NodeSize {
  width: number;
  height: number;
}

interface Position {
  x: number;
  y: number;
}

const FIXED_BASE_TOP = 100;

export interface FixedLayoutResult {
  meta: Map<string, StructureMeta>;
  positions: Map<string, Position>;
  sizeById: Map<string, NodeSize>;
}

export interface FixedLayoutOptions {
  rowGap?: number;
  treeGap?: number;
  siblingGap?: number;
}

function buildChildrenMap(nodes: Node<NodeData>[]) {
  const map = new Map<string, Node<NodeData>[]>();
  for (const node of nodes) {
    const key = node.data.parentId ?? ROOT_KEY;
    const bucket = map.get(key) ?? [];
    bucket.push(node);
    map.set(key, bucket);
  }
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  for (const [key, bucket] of map) {
    bucket.sort((a, b) => (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0));
    map.set(key, bucket);
  }
  return map;
}

function buildStructureMeta(nodes: Node<NodeData>[]) {
  const childrenByParent = buildChildrenMap(nodes);
  const meta = new Map<string, StructureMeta>();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const userRunLengthMemo = new Map<string, number>();
  const visited = new Set<string>();

  const userRunLength = (nodeId: string): number => {
    if (userRunLengthMemo.has(nodeId)) {
      return userRunLengthMemo.get(nodeId) ?? 1;
    }
    const node = nodeById.get(nodeId);
    if (!node || node.data.role !== "user") {
      userRunLengthMemo.set(nodeId, 0);
      return 0;
    }
    const children = childrenByParent.get(nodeId) ?? [];
    const childUserDepth = Math.max(
      0,
      ...children
        .filter((child) => child.data.role === "user")
        .map((child) => userRunLength(child.id))
    );
    const length = 1 + childUserDepth;
    userRunLengthMemo.set(nodeId, length);
    return length;
  };

  const toLayer = (value: number) => Number(value.toFixed(6));

  const walk = (
    node: Node<NodeData>,
    siblingOrder: number,
    baseX: number,
    rootId: string,
    context: {
      layer: number;
      userSlot: number;
      userRunRootId: string | null;
      userDepth: number;
    }
  ) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    let layer = context.layer;
    let userSlot = context.userSlot;
    let userRunRootId = context.userRunRootId;
    let userDepth = context.userDepth;

    const parent = node.data.parentId ? nodeById.get(node.data.parentId) ?? null : null;

    if (node.data.role === "user") {
      const startsNewRun = parent?.data.role !== "user";
      if (startsNewRun) {
        userRunRootId = node.id;
        userDepth = 1;
        if (!parent) {
          userSlot = 0;
        } else {
          const parentLayer = meta.get(parent.id)?.layer ?? 0;
          userSlot = Math.floor(parentLayer) + 1;
        }
      } else {
        userDepth = context.userDepth + 1;
      }
      const runLength = userRunRootId ? Math.max(1, userRunLength(userRunRootId)) : 1;
      layer = toLayer(userSlot + (userDepth - 1) / runLength);
    } else {
      const fallbackLayer = parent ? (meta.get(parent.id)?.layer ?? 0) : 0;
      layer = toLayer(userSlot + 1);
      if (!parent || parent.data.role !== "user") {
        layer = toLayer(Math.ceil(fallbackLayer));
      }
      userRunRootId = null;
      userDepth = 0;
      userSlot = Math.floor(layer);
    }

    meta.set(node.id, { layer, siblingOrder, baseX, rootId });
    const children = childrenByParent.get(node.id) ?? [];
    const centerOffset = (children.length - 1) / 2;
    children.forEach((child, index) =>
      walk(child, index, baseX + (index - centerOffset), rootId, {
        layer,
        userSlot,
        userRunRootId,
        userDepth,
      })
    );
  };

  const roots = childrenByParent.get(ROOT_KEY) ?? [];
  roots.forEach((root, index) =>
    walk(root, index, index * FIXED_ROOT_SPREAD, root.id, {
      layer: 0,
      userSlot: 0,
      userRunRootId: null,
      userDepth: 0,
    })
  );

  nodes.forEach((node, index) => {
    if (!meta.has(node.id)) {
      meta.set(node.id, { layer: 0, siblingOrder: index, baseX: index * FIXED_ROOT_SPREAD, rootId: node.id });
    }
  });

  return meta;
}

export function estimateNodeSize(node: Node<NodeData>): NodeSize {
  const textLen = node.data.text?.length ?? 0;
  if (node.data.role === "assistant") {
    const width = Math.min(880, Math.max(280, 220 + textLen * 5.2));
    const lines = Math.max(1, Math.ceil(textLen / 56));
    const height = Math.min(680, Math.max(130, 92 + lines * 22));
    return { width, height };
  }
  const width = Math.min(520, Math.max(200, 190 + textLen * 0.28));
  const lines = Math.max(1, Math.ceil(textLen / 44));
  const height = Math.max(86, 64 + lines * 22);
  return { width, height };
}

export function buildFixedPositions(
  nodes: Node<NodeData>[],
  nodeSizes: Map<string, { width: number; height: number }>,
  options?: FixedLayoutOptions
): FixedLayoutResult {
  const rowGap = options?.rowGap ?? FIXED_ROW_GAP;
  const treeGap = options?.treeGap ?? FIXED_TREE_GAP;
  const siblingGap = options?.siblingGap ?? FIXED_MIN_COL_GAP;
  const meta = buildStructureMeta(nodes);
  const childrenByParent = buildChildrenMap(nodes);
  const positions = new Map<string, Position>();
  const sizeById = new Map(
    nodes.map((node) => {
      const measured = nodeSizes.get(node.id);
      return [node.id, measured ?? estimateNodeSize(node)] as const;
    })
  );

  const rowIndexes = Array.from(new Set(Array.from(meta.values()).map((item) => item.layer))).sort((a, b) => a - b);
  // Vertical spacing is computed per disconnected tree so another tree's tall
  // node doesn't stretch this tree's lane distances.
  const rowHeightByRootLayer = new Map<string, Map<number, number>>();
  const rowTopByRootLayer = new Map<string, Map<number, number>>();
  const roots = Array.from(new Set(nodes.map((node) => meta.get(node.id)?.rootId ?? node.id)));

  for (const rootId of roots) {
    const rootNodes = nodes.filter((node) => (meta.get(node.id)?.rootId ?? node.id) === rootId);
    const rootLayers = Array.from(new Set(rootNodes.map((node) => meta.get(node.id)?.layer ?? 0))).sort((a, b) => a - b);
    const heightByLayer = new Map<number, number>();
    const topByLayer = new Map<number, number>();

    for (const layer of rootLayers) {
      const layerNodes = rootNodes.filter((node) => (meta.get(node.id)?.layer ?? 0) === layer);
      heightByLayer.set(layer, Math.max(...layerNodes.map((node) => sizeById.get(node.id)?.height ?? 120)));
    }

    for (let i = 0; i < rootLayers.length; i += 1) {
      const layer = rootLayers[i];
      if (i === 0) {
        topByLayer.set(layer, FIXED_BASE_TOP);
        continue;
      }
      const prevLayer = rootLayers[i - 1];
      const prevTop = topByLayer.get(prevLayer) ?? FIXED_BASE_TOP;
      const prevHeight = heightByLayer.get(prevLayer) ?? 0;
      topByLayer.set(layer, prevTop + prevHeight + rowGap);
    }

    rowHeightByRootLayer.set(rootId, heightByLayer);
    rowTopByRootLayer.set(rootId, topByLayer);
  }

  const packRowGroup = (
    groupNodesRaw: Node<NodeData>[],
    targetById: Map<string, number>,
    anchorById: Map<string, boolean>,
    rowTop: number
  ) => {
    const groupNodesWithTargets = groupNodesRaw.map((node) => {
      const parentId = node.data.parentId;
      const parentX = parentId ? positions.get(parentId)?.x : undefined;
      return {
        node,
        targetX: targetById.get(node.id) ?? (meta.get(node.id)?.baseX ?? 0) * FIXED_X_STEP,
        parentX: parentX ?? Number.NEGATIVE_INFINITY,
        siblingOrder: meta.get(node.id)?.siblingOrder ?? 0,
        anchored: anchorById.get(node.id) ?? false,
      };
    });
    // Non-crossing preference:
    // keep children grouped by parent X order, then preserve sibling order.
    groupNodesWithTargets.sort((a, b) => {
      if (a.parentX !== b.parentX) return a.parentX - b.parentX;
      if (a.siblingOrder !== b.siblingOrder) return a.siblingOrder - b.siblingOrder;
      return a.targetX - b.targetX;
    });

    const placedX = new Map<string, number>();
    let prevCenterX: number | null = null;
    let prevHalfW = 0;

    for (let i = 0; i < groupNodesWithTargets.length; i += 1) {
      const { node, targetX, anchored } = groupNodesWithTargets[i];
      const size = sizeById.get(node.id) ?? { width: 280, height: 120 };
      const halfW = size.width / 2;
      let centerX = targetX;
      if (prevCenterX !== null) {
        const minCenter = prevCenterX + prevHalfW + halfW + siblingGap;
        centerX = Math.max(centerX, minCenter);
        if (anchored && centerX > targetX) {
          const delta = centerX - targetX;
          let leftBarrier = -1;
          for (let k = i - 1; k >= 0; k -= 1) {
            if (groupNodesWithTargets[k].anchored) {
              leftBarrier = k;
              break;
            }
          }
          if (leftBarrier + 1 <= i - 1) {
            for (let k = leftBarrier + 1; k <= i - 1; k += 1) {
              const leftNodeId = groupNodesWithTargets[k].node.id;
              placedX.set(leftNodeId, (placedX.get(leftNodeId) ?? 0) - delta);
            }
            centerX = targetX;
          }
        }
      }
      placedX.set(node.id, centerX);
      prevCenterX = centerX;
      prevHalfW = halfW;
    }

    const hasAnchors = groupNodesWithTargets.some((item) => item.anchored);
    let shift = 0;
    if (!hasAnchors) {
      const desiredCenters = groupNodesWithTargets.map((item) => item.targetX);
      const actualCenters = groupNodesWithTargets.map((item) => placedX.get(item.node.id) ?? 0);
      const desiredMean = desiredCenters.reduce((sum, value) => sum + value, 0) / Math.max(desiredCenters.length, 1);
      const actualMean = actualCenters.reduce((sum, value) => sum + value, 0) / Math.max(actualCenters.length, 1);
      shift = desiredMean - actualMean;
    }

    for (const { node } of groupNodesWithTargets) {
      positions.set(node.id, {
        x: (placedX.get(node.id) ?? 0) + shift,
        y: rowTop,
      });
    }
  };

  for (const layer of rowIndexes) {
    const rowNodes = nodes.filter((node) => (meta.get(node.id)?.layer ?? 0) === layer);
    const byRoot = new Map<string, Node<NodeData>[]>();
    for (const node of rowNodes) {
      const rootId = meta.get(node.id)?.rootId ?? node.id;
      const bucket = byRoot.get(rootId) ?? [];
      bucket.push(node);
      byRoot.set(rootId, bucket);
    }

    for (const [rootId, groupNodesRaw] of byRoot) {
      const rowTop = rowTopByRootLayer.get(rootId)?.get(layer) ?? FIXED_BASE_TOP;
      const targetById = new Map<string, number>();
      const anchorById = new Map<string, boolean>();
      for (const node of groupNodesRaw) {
        const parentId = node.data.parentId;
        if (parentId) {
          const siblings = childrenByParent.get(parentId) ?? [];
          const sameRoleSiblings = siblings.filter((child) => child.data.role === node.data.role);
          const isSingleContinuation = sameRoleSiblings.length === 1 && sameRoleSiblings[0]?.id === node.id;
          const isOnlyChild = siblings.length === 1;
          if (isSingleContinuation || isOnlyChild) {
            const parentPos = positions.get(parentId);
            if (parentPos) {
              targetById.set(node.id, parentPos.x);
              anchorById.set(node.id, true);
              continue;
            }
          }
        }
        targetById.set(node.id, (meta.get(node.id)?.baseX ?? 0) * FIXED_X_STEP);
        anchorById.set(node.id, false);
      }
      packRowGroup(groupNodesRaw, targetById, anchorById, rowTop);
    }
  }

  // Bottom-up refinement: nudge parent rows toward resolved children anchors.
  const rowIndexesDesc = [...rowIndexes].sort((a, b) => b - a);
  for (const layer of rowIndexesDesc) {
    const rowNodes = nodes.filter((node) => (meta.get(node.id)?.layer ?? 0) === layer);
    const byRoot = new Map<string, Node<NodeData>[]>();
    for (const node of rowNodes) {
      const rootId = meta.get(node.id)?.rootId ?? node.id;
      const bucket = byRoot.get(rootId) ?? [];
      bucket.push(node);
      byRoot.set(rootId, bucket);
    }
    for (const [rootId, groupNodesRaw] of byRoot) {
      const rowTop = rowTopByRootLayer.get(rootId)?.get(layer) ?? FIXED_BASE_TOP;
      const targetById = new Map<string, number>();
      const anchorById = new Map<string, boolean>();
      for (const node of groupNodesRaw) {
        const children = childrenByParent.get(node.id) ?? [];
        const childrenWithPos = children
          .map((child) => positions.get(child.id)?.x)
          .filter((value): value is number => typeof value === "number");
        if (childrenWithPos.length > 0) {
          const avgChildX = childrenWithPos.reduce((sum, value) => sum + value, 0) / childrenWithPos.length;
          targetById.set(node.id, avgChildX);
          anchorById.set(node.id, childrenWithPos.length === 1);
        } else {
          targetById.set(node.id, positions.get(node.id)?.x ?? (meta.get(node.id)?.baseX ?? 0) * FIXED_X_STEP);
          anchorById.set(node.id, false);
        }
      }
      packRowGroup(groupNodesRaw, targetById, anchorById, rowTop);
    }
  }

  // Keep disconnected trees from colliding by shifting whole components.
  const components = new Map<string, { minX: number; maxX: number }>();
  for (const node of nodes) {
    const rootId = meta.get(node.id)?.rootId ?? node.id;
    const pos = positions.get(node.id);
    const size = sizeById.get(node.id) ?? { width: 280, height: 120 };
    if (!pos) continue;
    const left = pos.x - size.width / 2;
    const right = pos.x + size.width / 2;
    const bounds = components.get(rootId);
    if (!bounds) {
      components.set(rootId, { minX: left, maxX: right });
    } else {
      components.set(rootId, { minX: Math.min(bounds.minX, left), maxX: Math.max(bounds.maxX, right) });
    }
  }

  const rootOrder = Array.from(
    new Set(nodes.map((node) => meta.get(node.id)?.rootId ?? node.id))
  );
  const componentShift = new Map<string, number>();
  let prevMaxX: number | null = null;
  for (const rootId of rootOrder) {
    const bounds = components.get(rootId);
    if (!bounds) continue;
    const currentShift = componentShift.get(rootId) ?? 0;
    if (prevMaxX !== null) {
      const minAllowedLeft = prevMaxX + treeGap;
      const currentLeft = bounds.minX + currentShift;
      if (currentLeft < minAllowedLeft) {
        componentShift.set(rootId, currentShift + (minAllowedLeft - currentLeft));
      }
    }
    const appliedShift = componentShift.get(rootId) ?? 0;
    prevMaxX = bounds.maxX + appliedShift;
  }

  for (const node of nodes) {
    const rootId = meta.get(node.id)?.rootId ?? node.id;
    const shift = componentShift.get(rootId) ?? 0;
    const pos = positions.get(node.id);
    if (!pos || shift === 0) continue;
    positions.set(node.id, { x: pos.x + shift, y: pos.y });
  }

  // Vertical lane refinement: keep single-child continuations at an exact
  // edge-to-edge gap from parent, independent of other branch row heights.
  const layerCountByRoot = new Map<string, Map<number, number>>();
  for (const node of nodes) {
    const rootId = meta.get(node.id)?.rootId ?? node.id;
    const layer = meta.get(node.id)?.layer ?? 0;
    const rootLayerMap = layerCountByRoot.get(rootId) ?? new Map<number, number>();
    rootLayerMap.set(layer, (rootLayerMap.get(layer) ?? 0) + 1);
    layerCountByRoot.set(rootId, rootLayerMap);
  }

  const nodesByLayer = [...nodes].sort(
    (a, b) => (meta.get(a.id)?.layer ?? 0) - (meta.get(b.id)?.layer ?? 0)
  );
  for (const node of nodesByLayer) {
    const parentId = node.data.parentId;
    if (!parentId) continue;
    const rootId = meta.get(node.id)?.rootId ?? node.id;
    const layer = meta.get(node.id)?.layer ?? 0;
    if ((layerCountByRoot.get(rootId)?.get(layer) ?? 0) !== 1) continue;
    const siblings = childrenByParent.get(parentId) ?? [];
    if (siblings.length !== 1) continue;
    const parentPos = positions.get(parentId);
    const nodePos = positions.get(node.id);
    if (!parentPos || !nodePos) continue;
    const parentHeight = sizeById.get(parentId)?.height ?? 120;
    positions.set(node.id, {
      x: nodePos.x,
      y: parentPos.y + parentHeight + rowGap,
    });
  }

  return { meta, positions, sizeById };
}
