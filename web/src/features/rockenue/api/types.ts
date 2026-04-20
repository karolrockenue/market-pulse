// ── Enums ──
export type Priority = "urgent" | "high" | "medium" | "low";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskCategory = "distribution" | "revenue" | "operations" | "onboarding" | "content" | "finance";
export type AgreementType = "group" | "individual" | "direct" | "meta";
export type ChannelTier = "primary" | "secondary" | "experimental";
export type IntegrationType = "channel_manager" | "direct_api" | "extranet" | "meta_search";
export type ChannelType = "ota" | "wholesaler" | "flash_sale" | "direct" | "meta";
export type PaymentMethod = "guest_pays" | "vcc" | "bacs";
export type GridStatus = "live" | "onboarding" | "suspended" | "none";

// ── CRM Tasks ──
export interface CrmTask {
  id: number;
  title: string;
  description: string | null;
  hotel_id: number | null;
  hotel_ids: number[];
  channel_id: number | null;
  hotel_name: string | null;
  hotel_names: string[];
  channel_name: string | null;
  channel_slug: string | null;
  assignee: string | null;
  priority: Priority;
  status: TaskStatus;
  category: TaskCategory;
  due_date: string | null;
  tags: string[];
  notify_assignee: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  subtask_done: number;
  subtask_total: number;
  comment_count: number;
}

export interface CrmTaskComment {
  id: number;
  task_id: number;
  author: string;
  body: string;
  type: "comment" | "activity";
  created_at: string;
}

export interface CrmTaskSubtask {
  id: number;
  task_id: number;
  text: string;
  done: boolean;
  sort_order: number;
}

// ── Channels ──
export interface ChannelContact {
  id: number;
  channel_id: number;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
}

export interface ChannelNote {
  id: number;
  channel_id: number;
  author: string;
  body: string;
  created_at: string;
}

export interface DistributionChannel {
  id: number;
  name: string;
  slug: string;
  agreement_type: AgreementType;
  tier: ChannelTier;
  integration_type: IntegrationType;
  commission_pct: number | null;
  channel_type: ChannelType | null;
  payment_method: PaymentMethod | null;
  contract_expiry: string | null;
  notes: string | null;
  added_at: string;
  updated_at: string;
  properties_connected: number;
  contacts: ChannelContact[];
  internal_notes: ChannelNote[];
}

// ── Distribution Grid ──
export interface GridHotel {
  hotel_id: number;
  hotel_name: string;
}

export interface GridChannel {
  id: number;
  name: string;
  slug: string;
}

export interface GridCell {
  status: GridStatus;
  suspension_reason: string | null;
  suspended_by: string | null;
  suspended_at: string | null;
}

export interface DistributionGridData {
  hotels: GridHotel[];
  channels: GridChannel[];
  grid: Record<number, Record<number, GridCell>>;
}

// ── Team ──
export interface TeamMember {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: "admin" | "super_admin";
}

// ── Filters ──
export interface TaskFilters {
  status?: TaskStatus;
  assignee?: string;
  category?: TaskCategory;
  priority?: Priority;
  hotel_id?: number;
  channel_id?: number;
}
