// web/src/features/reports/api/types.ts

export interface ReportHeader {
  key: string;
  label: string;
  format?: "currency" | "percentage" | "number" | "string" | "date";
}

export interface ReportRow {
  [key: string]: string | number | null | undefined;
}

export interface ReportSummary {
  [key: string]: string | number | null | undefined;
}

export interface ReportData {
  title: string;
  headers: ReportHeader[];
  rows: ReportRow[];
  summary?: ReportSummary;
  currency?: string;
  generatedAt?: string;
}

export interface ReportParams {
  hotelId: string;
  reportType: string;
  startDate: string;
  endDate: string;
  compareTo?: string;
  // [ADD THESE]
  metrics?: string[];
  granularity?: string;
  includeTaxes?: boolean;
}
export interface Schedule {
  id: string;
  hotel_id: number;
  report_type: string;
  cron_expression: string;
  recipients: string[]; // JSON array of emails
  format: "pdf" | "csv" | "html";
  is_active: boolean;
  last_run?: string;
  created_at?: string;
}

// Replace it with this expanded version:
export interface CreateSchedulePayload {
  hotelId: string;
  reportType: string;
  cronExpression: string;
  recipients: string[];
  format: "pdf" | "csv" | "html"; // Added html just in case
  reportName?: string;
  [key: string]: any; // Allow flexible fields (frequency, timeOfDay, etc.)
}
