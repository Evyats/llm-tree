import type { GraphResponse } from "../../types/graph";
import type { ChatSummary, GenerateGraphTitleResponse } from "../types";
import { request } from "../http";

export async function createGraph(title?: string): Promise<{ graph_id: string }> {
  return request("/api/graphs", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function getGraph(graphId: string): Promise<GraphResponse> {
  return request(`/api/graphs/${graphId}`);
}

export async function listGraphs(): Promise<ChatSummary[]> {
  return request("/api/graphs");
}

export async function renameGraph(graphId: string, title: string): Promise<ChatSummary> {
  return request(`/api/graphs/${graphId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function generateGraphTitle(graphId: string, selectedModel: string): Promise<GenerateGraphTitleResponse> {
  return request(`/api/graphs/${graphId}/generate-title`, {
    method: "POST",
    body: JSON.stringify({ selected_model: selectedModel }),
  });
}

export async function updateGraphCollapsedState(
  graphId: string,
  collapsedTargets: string[],
  collapsedEdgeSources: Record<string, string>
): Promise<{ collapsed_targets: string[]; collapsed_edge_sources: Record<string, string> }> {
  return request(`/api/graphs/${graphId}/collapsed-state`, {
    method: "PUT",
    body: JSON.stringify({
      collapsed_targets: collapsedTargets,
      collapsed_edge_sources: collapsedEdgeSources,
    }),
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
