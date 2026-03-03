import type { GraphNodePayload } from "../../types/graph";
import type { TranscriptLine } from "./types";

export function buildTranscriptFromPayloadNodes(nodes: GraphNodePayload[], targetNodeId: string): TranscriptLine[] {
  const index = new Map(nodes.map((node) => [node.id, node]));
  const chain: GraphNodePayload[] = [];
  let current = index.get(targetNodeId) ?? null;
  while (current) {
    chain.push(current);
    current = current.parent_id ? index.get(current.parent_id) ?? null : null;
  }
  chain.reverse();
  return chain.map((node) => ({ role: node.role, content: node.text }));
}
