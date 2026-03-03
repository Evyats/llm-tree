import type { Node } from "reactflow";

import type { NodeData } from "../../store/useGraphStore";

export function buildTranscriptUntilNode(nodes: Node<NodeData>[], targetNodeId: string) {
  const index = new Map(nodes.map((node) => [node.id, node]));
  const chain: Node<NodeData>[] = [];
  let current = index.get(targetNodeId) ?? null;

  while (current) {
    chain.push(current);
    const parentId = current.data.parentId;
    current = parentId ? index.get(parentId) ?? null : null;
  }

  chain.reverse();
  return chain.map((node) => ({
    role: node.data.role,
    content: node.data.text,
  }));
}
