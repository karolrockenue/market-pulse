import type {
  CrmTask,
  CrmTaskComment,
  CrmTaskSubtask,
  DistributionChannel,
  DistributionGridData,
  TaskFilters,
  TeamMember,
} from "./types";

const BASE = "/api/distribution";

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

// ═══════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════

export function fetchTasks(filters?: TaskFilters): Promise<CrmTask[]> {
  const params = new URLSearchParams();
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return api(`${BASE}/tasks${qs ? `?${qs}` : ""}`);
}

export function createTask(data: Partial<CrmTask> & { created_by?: string }): Promise<CrmTask> {
  return api(`${BASE}/tasks`, { method: "POST", body: JSON.stringify(data) });
}

export function updateTask(id: number, data: Record<string, unknown>): Promise<CrmTask> {
  return api(`${BASE}/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteTask(id: number): Promise<{ success: boolean }> {
  return api(`${BASE}/tasks/${id}`, { method: "DELETE" });
}

// ── Comments ──

export function fetchComments(taskId: number): Promise<CrmTaskComment[]> {
  return api(`${BASE}/tasks/${taskId}/comments`);
}

export function addComment(taskId: number, data: { author: string; body: string; type?: string }): Promise<CrmTaskComment> {
  return api(`${BASE}/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify(data) });
}

// ── Subtasks ──

export function fetchSubtasks(taskId: number): Promise<CrmTaskSubtask[]> {
  return api(`${BASE}/tasks/${taskId}/subtasks`);
}

export function addSubtask(taskId: number, data: { text: string; sort_order?: number }): Promise<CrmTaskSubtask> {
  return api(`${BASE}/tasks/${taskId}/subtasks`, { method: "POST", body: JSON.stringify(data) });
}

export function updateSubtask(id: number, data: { done?: boolean; text?: string }): Promise<CrmTaskSubtask> {
  return api(`${BASE}/subtasks/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteSubtask(id: number): Promise<{ success: boolean }> {
  return api(`${BASE}/subtasks/${id}`, { method: "DELETE" });
}

// ═══════════════════════════════════════════
// CHANNELS
// ═══════════════════════════════════════════

export function fetchChannels(): Promise<DistributionChannel[]> {
  return api(`${BASE}/channels`);
}

export function createChannel(data: Partial<DistributionChannel>): Promise<DistributionChannel> {
  return api(`${BASE}/channels`, { method: "POST", body: JSON.stringify(data) });
}

export function updateChannel(id: number, data: Partial<DistributionChannel>): Promise<DistributionChannel> {
  return api(`${BASE}/channels/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteChannel(id: number): Promise<{ success: boolean }> {
  return api(`${BASE}/channels/${id}`, { method: "DELETE" });
}

// ── Contacts ──

export function addContact(channelId: number, data: { name: string; role?: string; email?: string; phone?: string }) {
  return api(`${BASE}/channels/${channelId}/contacts`, { method: "POST", body: JSON.stringify(data) });
}

export function updateContact(id: number, data: Record<string, unknown>) {
  return api(`${BASE}/contacts/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteContact(id: number) {
  return api(`${BASE}/contacts/${id}`, { method: "DELETE" });
}

// ── Notes ──

export function addNote(channelId: number, data: { author: string; body: string }) {
  return api(`${BASE}/channels/${channelId}/notes`, { method: "POST", body: JSON.stringify(data) });
}

export function deleteNote(id: number) {
  return api(`${BASE}/notes/${id}`, { method: "DELETE" });
}

// ═══════════════════════════════════════════
// GRID
// ═══════════════════════════════════════════

export function fetchGrid(): Promise<DistributionGridData> {
  return api(`${BASE}/grid`);
}

export function updateGridCell(data: { hotel_id: number; channel_id: number; status: string; suspension_reason?: string; suspended_by?: string }): Promise<{ success: boolean }> {
  return api(`${BASE}/grid`, { method: "PATCH", body: JSON.stringify(data) });
}

// ═══════════════════════════════════════════
// TEAM
// ═══════════════════════════════════════════

export function fetchTeam(): Promise<TeamMember[]> {
  return api(`${BASE}/team`);
}

// ═══════════════════════════════════════════
// CHANNEL PRICING
// ═══════════════════════════════════════════

export function fetchPricingChannels(): Promise<any[]> {
  return api(`${BASE}/pricing`);
}

export function fetchChannelPricing(channelId: number): Promise<any> {
  return api(`${BASE}/pricing/${channelId}`);
}

export function updateChannelPricingSteps(channelId: number, steps: any[]): Promise<any> {
  return api(`${BASE}/pricing/${channelId}`, { method: "PATCH", body: JSON.stringify({ steps }) });
}

export function setHotelPricingOverride(channelId: number, hotelId: number, overrides: Record<string, any>): Promise<any> {
  return api(`${BASE}/pricing/${channelId}/override/${hotelId}`, { method: "PUT", body: JSON.stringify({ overrides }) });
}

export function deleteHotelPricingOverride(channelId: number, hotelId: number): Promise<{ success: boolean }> {
  return api(`${BASE}/pricing/${channelId}/override/${hotelId}`, { method: "DELETE" });
}
