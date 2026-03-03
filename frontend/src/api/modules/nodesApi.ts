import { request } from "../http";

export async function updateVariant(nodeId: string, variantIndex: number): Promise<void> {
  await request(`/api/nodes/${nodeId}/variant-index`, {
    method: "PATCH",
    body: JSON.stringify({ variant_index: variantIndex }),
  });
}

export async function deleteNodeSubtree(nodeId: string): Promise<void> {
  await request(`/api/nodes/${nodeId}/subtree`, {
    method: "DELETE",
  });
}
