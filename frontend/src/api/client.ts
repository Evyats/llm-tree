import type { GraphEdgePayload, GraphNodePayload, GraphResponse } from "../types/graph";

const base = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function createGraph(title?: string): Promise<{ graph_id: string }> {
  return request("/api/graphs", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function getGraph(graphId: string): Promise<GraphResponse> {
  return request(`/api/graphs/${graphId}`);
}

export async function listGraphs(): Promise<Array<{ graph_id: string; title: string; updated_at: string }>> {
  return request("/api/graphs");
}

export async function renameGraph(
  graphId: string,
  title: string
): Promise<{ graph_id: string; title: string; updated_at: string }> {
  return request(`/api/graphs/${graphId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteGraph(graphId: string): Promise<void> {
  await request(`/api/graphs/${graphId}`, {
    method: "DELETE",
  });
}

export async function deleteAllGraphs(): Promise<{ deleted: number }> {
  return request("/api/graphs", {
    method: "DELETE",
  });
}

export async function continueFromNode(payload: {
  graph_id: string;
  continue_from_node_id: string | null;
  user_text: string;
  mode: "normal" | "elaboration";
  highlighted_text?: string | null;
}): Promise<{
  created_user_node: GraphNodePayload;
  created_assistant_node: GraphNodePayload;
  created_edges: GraphEdgePayload[];
  response_source: "live" | "fallback";
  transcript_window: Array<{ role: string; content: string }>;
}> {
  return request("/api/messages/continue", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function continueInPanel(payload: {
  graph_id: string;
  anchor_node_id: string;
  user_text: string;
}): Promise<{
  created_user_node: GraphNodePayload;
  created_assistant_node: GraphNodePayload;
  created_edges: GraphEdgePayload[];
  response_source: "live" | "fallback";
  transcript_window: Array<{ role: string; content: string }>;
}> {
  return request("/api/chat/continue", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateVariant(nodeId: string, variantIndex: number): Promise<void> {
  await request(`/api/nodes/${nodeId}/variant-index`, {
    method: "PATCH",
    body: JSON.stringify({ variant_index: variantIndex }),
  });
}

export async function setSessionApiKey(apiKey: string): Promise<void> {
  await request("/api/session/api-key", {
    method: "POST",
    body: JSON.stringify({ api_key: apiKey }),
  });
}
