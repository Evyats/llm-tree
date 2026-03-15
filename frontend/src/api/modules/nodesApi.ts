import type { GraphEdgePayload, GraphNodePayload } from "../../types/graph";
import type { CompactBranchResponse } from "../types";
import { request } from "../http";

export async function updateVariant(nodeId: string, variantIndex: number): Promise<void> {
  await request(`/api/nodes/${nodeId}/variant-index`, {
    method: "PATCH",
    body: JSON.stringify({ variant_index: variantIndex }),
  });
}

export async function lockVariant(nodeId: string, variantIndex: number): Promise<void> {
  await request(`/api/nodes/${nodeId}/variant-index`, {
    method: "PATCH",
    body: JSON.stringify({ variant_index: variantIndex, lock_selected: true }),
  });
}

export async function deleteNodeSubtree(nodeId: string): Promise<void> {
  await request(`/api/nodes/${nodeId}/subtree`, {
    method: "DELETE",
  });
}

export async function extractNodePath(nodeId: string): Promise<{
  created_nodes: GraphNodePayload[];
  created_edges: GraphEdgePayload[];
}> {
  return request(`/api/nodes/${nodeId}/extract-path`, {
    method: "POST",
  });
}

export async function compactBranch(nodeId: string, selectedModel: string): Promise<CompactBranchResponse> {
  return request(`/api/nodes/${nodeId}/compact`, {
    method: "POST",
    body: JSON.stringify({ selected_model: selectedModel }),
  });
}
