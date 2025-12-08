export interface Hotel {
  hotel_id: number;
  property_name: string;
  property_type: string;
  city: string;
  neighborhood: string;
  category: string;
  total_rooms: number | null;
  pms_type?: string;
  is_rockenue_managed: boolean;
  management_group: string | null;
}

export interface ScheduledReport {
  id: string;
  report_name: string;
  frequency: string;
  recipients: string[];
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}

export interface SystemStatus {
  last_successful_run: string | null;
  status: 'healthy' | 'warning' | 'error';
}

export interface SyncResponse {
  success: boolean;
  message?: string;
  error?: string;
}