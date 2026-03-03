import type { GraphResponse } from "../../types/graph";
import type { ChatSummary } from "../types";
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
