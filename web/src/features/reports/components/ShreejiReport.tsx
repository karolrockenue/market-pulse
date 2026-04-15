import { useState, useEffect } from "react";
import { R } from "../../../styles/tokens";
import { Card } from "../../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../components/ui/tabs";
import { Calendar } from "../../../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
// [NEW] Import new icons and components
import {
  CalendarIcon,
  Download,
  FileText,
  Loader2,
  Trash2,
  Clock,
  Plus,
} from "lucide-react";
import { Input } from "../../../components/ui/input"; // [NEW]
import { toast } from "sonner";

// ... [interfaces GuestData, DailyTakings, ReportData remain the same] ...
interface GuestData {
  room: string;
  pax: number;
  guestName: string;
  totalRate: number;
  arrival: string;
  departure: string;
  outstanding: number;
  agency: string;
}

interface DailyTakings {
  [key: string]: number;
}

interface ReportData {
  hotelName: string;
  date: Date;
  summary: {
    vacant: number | string;
    blocked: number | string;
    sold: number;
    occupancy: number;
    revpar: number;
    adr: number;
    dayRevenue: number;
  };
  inHouseGuests: GuestData[];
  dailyTakings: DailyTakings;
  blockedRooms: string[];
}

// [NEW] Interface for scheduled report prop
interface ScheduledReport {
  id: string;
  report_name: string;
  property_id: string;
  recipients: string;
  frequency: string;
  time_of_day: string;
  day_of_week?: number;
  day_of_month?: number;
}

// [NEW] Interface for component props
interface ShreejiReportProps {
  scheduledReports: ScheduledReport[];
  isLoadingSchedules: boolean;
  onSaveSchedule: (payload: any) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
}

/**
 * Formats a Date object to YYYY-MM-DD string for API calls
 */
const formatDateForApi = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

// [MODIFIED] Update function signature to accept props
export function ShreejiReport({
  scheduledReports,
  isLoadingSchedules,
  onSaveSchedule,
  onDeleteSchedule,
}: ShreejiReportProps) {
  const [selectedHotel, setSelectedHotel] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [hotels, setHotels] = useState<
    { hotel_id: string; property_name: string }[]
  >([]);

  // --- [NEW] State for the schedule form ---
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleHotelId, setScheduleHotelId] = useState("");
  const [scheduleRecipients, setScheduleRecipients] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState("Daily");
  const [scheduleTime, setScheduleTime] = useState("06:00"); // 6am UTC default
  const [isSaving, setIsSaving] = useState(false);

  // Fetch hotels on component mount (existing logic)
  // Fetch hotels on component mount (existing logic)
  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const response = await fetch("/api/hotels/mine");
        if (!response.ok) {
          throw new Error("Failed to fetch hotels");
        }
        const data = await response.json();
        // Map API response (property_id) to component state (hotel_id)
        const mappedHotels = data.map((h: any) => ({
          hotel_id: h.property_id,
          property_name: h.property_name,
        }));
        setHotels(mappedHotels);
      } catch (error) {
        console.error(error);
        toast.error(error.message || "Could not load hotels");
      }
    };
    fetchHotels();
  }, []);

  // ... [handlePreview, handleDownloadPDF, formatCurrency, formatDate, getTotalTakings remain the same] ...
  const handlePreview = async () => {
    if (!selectedHotel || !selectedDate) {
      toast.error("Please select both hotel and date");
      return;
    }
    setIsLoading(true);
    setReportData(null);
    try {
      const hotel = hotels.find((h) => h.hotel_id === selectedHotel);
      if (!hotel) {
        toast.error("Selected hotel not found.");
        return;
      }
      const dateStr = formatDateForApi(selectedDate);
      const response = await fetch(
        `/api/metrics/reports/shreeji?hotel_id=${selectedHotel}&date=${dateStr}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate report");
      }
      const mappedData: ReportData = {
        hotelName: hotel.property_name,
        date: selectedDate,
        summary: {
          vacant: data.summary.vacant,
          blocked: data.summary.blocked,
          sold: data.summary.sold,
          occupancy: data.summary.occupancy,
          revpar: data.summary.revpar,
          adr: data.summary.adr,
          dayRevenue: data.summary.revenue,
        },
        inHouseGuests: data.reportData.map((guest: any) => ({
          room: guest.roomName,
          pax: guest.pax,
          guestName: guest.guestName,
          totalRate: guest.grandTotal,
          arrival: guest.checkInDate,
          departure: guest.checkOutDate,
          outstanding: guest.balance,
          agency: guest.source,
        })),
        dailyTakings: data.takings,
        blockedRooms: data.blocks.names,
      };
      setReportData(mappedData);
      toast.success("Report generated successfully");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!selectedHotel || !selectedDate) {
      toast.error("Please select a hotel and date first");
      return;
    }
    try {
      const dateStr = formatDateForApi(selectedDate);
      const hotel = hotels.find((h) => h.hotel_id === selectedHotel);
      const hotelName = hotel?.property_name.replace(/\s/g, "_") || "Report";
      const downloadUrl = `/api/metrics/reports/shreeji/download?hotel_id=${selectedHotel}&date=${dateStr}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute(
        "download",
        `Shreeji_Report_${hotelName}_${dateStr}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("PDF download started");
    } catch (error) {
      console.error(error);
      toast.error("Failed to start PDF download");
    }
  };

  const formatCurrency = (value: number | string) => {
    const num = parseFloat(String(value));
    if (isNaN(num)) {
      return "£0.00";
    }
    return `£${num.toFixed(2)}`;
  };

  const formatDate = (date: Date) => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const dayName = days[date.getDay()];
    const formatted = date.toLocaleDateString("en-GB");
    return { dayName, formatted };
  };

  const getTotalTakings = (takings: DailyTakings) => {
    return Object.values(takings).reduce((sum, val) => sum + val, 0);
  };

  // --- [NEW] Handler for saving a schedule ---
  const handleSaveSchedule = async () => {
    if (!scheduleName || !scheduleHotelId || !scheduleRecipients) {
      toast.error("Please fill out Report Name, Hotel, and Recipients.");
      return;
    }

    setIsSaving(true);

    try {
      // 1. Convert time (e.g., "06:00") to cron expression (e.g., "0 6 * * *")
      const [hour = "06", minute = "00"] = scheduleTime
        ? scheduleTime.split(":")
        : [];
      const cronExpression = `${parseInt(minute)} ${parseInt(hour)} * * *`;

      // 2. Construct Payload
      const payload = {
        hotelId: scheduleHotelId, // REQUIRED so the API doesn't send undefined propertyId
        reportType: "shreeji",
        cronExpression: cronExpression,
        recipients: scheduleRecipients.split(",").map((e) => e.trim()),
        format: "pdf",

        // Extra Metadata
        reportName: scheduleName,
        propertyId: scheduleHotelId,
        frequency: scheduleFrequency,
        timeOfDay: scheduleTime,

        // Defaults for Backend Constraints
        metricsHotel: [],
        metricsMarket: [],
        addComparisons: false,
        displayOrder: "group-by-metric",
        displayTotals: false,
        includeTaxes: false,
        reportPeriod: "current-week",
        attachmentFormats: ["pdf"],
        year1: null,
        year2: null,
      };

      // 3. Send (cast to any to bypass strict checks if types.ts hasn't updated yet)
      await onSaveSchedule(payload as any);

      toast.success("Schedule saved successfully");

      // Clear form
      setScheduleName("");
      setScheduleHotelId("");
      setScheduleRecipients("");
    } catch (error) {
      console.error("Save Error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // --- [NEW] Helper to format schedule text ---
  const formatScheduleText = (report: ScheduledReport) => {
    if (report.frequency === "Daily") {
      return `Daily at ${report.time_of_day} UTC`;
    }
    // Add more logic for Weekly/Monthly as needed
    return `${report.frequency} at ${report.time_of_day} UTC`;
  };

  const getHotelName = (hotelId: string) => {
    return (
      hotels.find((h) => h.hotel_id === hotelId)?.property_name ||
      `Hotel ID: ${hotelId}`
    );
  };
  // --- [START OF JSX] ---
  return (
    <div
      className="space-y-6"
      style={{ flex: 1, background: R.bg, color: R.accent, padding: "24px 28px" }}
    >
      <div>
        {/* Page Header (existing) */}
        <div>
          <h1 className="text-white text-2xl mb-2">Shreeji Report</h1>
          <p className="text-[#7A8494] text-sm">
            Generate and schedule daily financial reports for property
            management
          </p>
        </div>

        {/* Report Controls (existing) */}
        <Card
          className="p-6"
          style={{
            backgroundColor: R.darkBand,
            border: `1px solid ${R.border}`,
            borderRadius: "0.5rem",
          }}
        >
          <div className="grid grid-cols-4 gap-4 items-end">
            {/* Select Hotel */}
            <div className="space-y-2">
              <label className="text-[#4E5868] text-xs uppercase tracking-tight font-medium mb-1.5 block">
                Select Hotel
              </label>
              <Select value={selectedHotel} onValueChange={setSelectedHotel}>
                <SelectTrigger
                  className="h-10"
                  style={{
                    backgroundColor: R.heroBg,
                    border: `1px solid ${R.border}`,
                    color: R.accent,
                  }}
                >
                  <SelectValue placeholder="Choose a hotel" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: R.darkBand,
                    border: `1px solid ${R.border}`,
                  }}
                >
                  {hotels.length === 0 && (
                    <SelectItem
                      value="loading"
                      disabled
                      className="text-[#7A8494]"
                    >
                      Loading hotels...
                    </SelectItem>
                  )}
                  {hotels.map((hotel) => (
                    <SelectItem
                      key={hotel.hotel_id}
                      value={hotel.hotel_id}
                      className="text-[#F3F5F7] focus:bg-[#1C2228] focus:text-[#38C6BA]"
                    >
                      {hotel.property_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Report Date */}
            <div className="space-y-2">
              <label
                className="text-xs uppercase tracking-tight font-medium mb-1.5 block"
                style={{ color: R.textDim }}
              >
                Report Date
              </label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-10"
                    style={{
                      backgroundColor: R.heroBg,
                      border: `1px solid ${R.border}`,
                      color: R.accent,
                    }}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate
                      ? selectedDate.toLocaleDateString("en-GB")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0"
                  align="start"
                  style={{
                    backgroundColor: R.darkBand,
                    border: `1px solid ${R.border}`,
                  }}
                >
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setDatePickerOpen(false);
                    }}
                    initialFocus
                    style={{ backgroundColor: R.darkBand, color: R.accent }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Actions (existing) */}
            <div className="col-span-2 flex gap-3 justify-end">
              <Button
                onClick={handlePreview}
                disabled={isLoading}
                className="font-medium h-10"
                style={{
                  backgroundColor: "#38C6BA",
                  color: R.darkBand,
                  border: "none",
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                Preview Report
              </Button>
              <Button
                onClick={handleSaveSchedule}
                disabled={isSaving}
                className="font-medium h-10"
                style={{
                  backgroundColor: "#38C6BA",
                  color: R.darkBand,
                  border: "none",
                }}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Save Schedule
              </Button>
            </div>
          </div>
        </Card>

        {/* --- [NEW] Report Schedules Section --- */}
        <div className="space-y-4">
          <h2 className="text-[#F3F5F7] text-lg font-semibold tracking-tight">
            Report Schedules
          </h2>

          {/* Create New Schedule Form */}
          <Card
            className="p-6"
            style={{ backgroundColor: R.darkBand, border: `1px solid ${R.border}` }}
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              {/* Report Name */}
              <div className="space-y-2 md:col-span-2">
                <label
                  className="text-xs uppercase tracking-tight font-medium mb-1.5 block"
                  style={{ color: R.textDim }}
                >
                  Report Name
                </label>
                <Input
                  placeholder="E.g. Daily Management Report"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  className="h-10"
                  style={{
                    backgroundColor: R.heroBg,
                    border: `1px solid ${R.border}`,
                    color: R.accent,
                  }}
                />
              </div>

              {/* Hotel */}
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-tight font-medium mb-1.5 block"
                  style={{ color: R.textDim }}
                >
                  Hotel
                </label>
                <Select
                  value={scheduleHotelId}
                  onValueChange={setScheduleHotelId}
                >
                  <SelectTrigger
                    className="h-10"
                    style={{
                      backgroundColor: R.heroBg,
                      border: `1px solid ${R.border}`,
                      color: R.accent,
                    }}
                  >
                    <SelectValue placeholder="Choose hotel" />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      backgroundColor: R.darkBand,
                      border: `1px solid ${R.border}`,
                    }}
                  >
                    {hotels.map((hotel) => (
                      <SelectItem
                        key={hotel.hotel_id}
                        value={hotel.hotel_id}
                        className="text-[#F3F5F7] focus:bg-[#1C2228] focus:text-[#38C6BA]"
                      >
                        {hotel.property_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Time */}
              <div className="space-y-2">
                <label
                  className="text-xs uppercase tracking-tight font-medium mb-1.5 block"
                  style={{ color: R.textDim }}
                >
                  Time (UTC)
                </label>
                <Select value={scheduleTime} onValueChange={setScheduleTime}>
                  <SelectTrigger
                    className="h-10"
                    style={{
                      backgroundColor: R.heroBg,
                      border: `1px solid ${R.border}`,
                      color: R.accent,
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      backgroundColor: R.darkBand,
                      border: `1px solid ${R.border}`,
                    }}
                  >
                    <SelectItem
                      value="14:05"
                      className="text-[#F3F5F7] focus:bg-[#1C2228]"
                    >
                      14:05
                    </SelectItem>
                    <SelectItem
                      value="14:10"
                      className="text-[#F3F5F7] focus:bg-[#1C2228]"
                    >
                      14:10
                    </SelectItem>
                    <SelectItem
                      value="08:00"
                      className="text-[#F3F5F7] focus:bg-[#1C2228]"
                    >
                      08:00
                    </SelectItem>
                    {/* --- ADD THESE TEMPORARY LINES FOR TESTING --- */}
                    <SelectItem
                      value="06:30"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      06:30 (Test)
                    </SelectItem>
                    <SelectItem
                      value="06:35"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      06:35 (Test)
                    </SelectItem>
                    <SelectItem
                      value="06:40"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      06:40 (Test)
                    </SelectItem>
                    <SelectItem
                      value="06:45"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      06:45 (Test)
                    </SelectItem>
                    <SelectItem
                      value="06:50"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      06:50 (Test)
                    </SelectItem>
                    <SelectItem
                      value="06:55"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      06:55 (Test)
                    </SelectItem>
                    <SelectItem
                      value="07:00"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      07:00 (Test)
                    </SelectItem>
                    <SelectItem
                      value="07:05"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      07:05 (Test)
                    </SelectItem>
                    <SelectItem
                      value="07:10"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      07:10 (Test)
                    </SelectItem>
                    <SelectItem
                      value="07:15"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      07:15 (Test)
                    </SelectItem>
                    <SelectItem
                      value="07:20"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      07:20 (Test)
                    </SelectItem>
                    <SelectItem
                      value="07:25"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      07:25 (Test)
                    </SelectItem>
                    <SelectItem
                      value="07:30"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      07:30 (Test)
                    </SelectItem>
                    <SelectItem
                      value="07:35"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      07:35 (Test)
                    </SelectItem>
                    <SelectItem
                      value="07:40"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      07:40 (Test)
                    </SelectItem>
                    <SelectItem
                      value="07:45"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      07:45 (Test)
                    </SelectItem>
                    <SelectItem
                      value="07:50"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      07:50 (Test)
                    </SelectItem>
                    <SelectItem
                      value="07:55"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      07:55 (Test)
                    </SelectItem>
                    <SelectItem
                      value="08:00"
                      className="text-[#38C6BA] focus:bg-[#1C2228]"
                    >
                      08:00 (Test)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Frequency (hidden, defaulting to Daily) */}
              {/* <input type="hidden" value={scheduleFrequency} /> */}

              {/* Save Button */}
              <Button
                onClick={handleSaveSchedule}
                disabled={isSaving}
                className="font-medium h-10"
                style={{
                  backgroundColor: "#38C6BA",
                  color: R.darkBand,
                  border: "none",
                }}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Save Schedule
              </Button>

              {/* Recipients (Full Width) */}
              <div className="space-y-2 md:col-span-5">
                <label
                  className="text-xs uppercase tracking-tight font-medium mb-1.5 block"
                  style={{ color: R.textDim }}
                >
                  Recipient Emails
                </label>
                <Input
                  placeholder="user1@example.com, user2@example.com"
                  value={scheduleRecipients}
                  onChange={(e) => setScheduleRecipients(e.target.value)}
                  className="h-10"
                  style={{
                    backgroundColor: R.heroBg,
                    border: `1px solid ${R.border}`,
                    color: R.accent,
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Existing Schedules Table */}
          <Card
            style={{ backgroundColor: R.darkBand, border: `1px solid ${R.border}` }}
          >
            <Table>
              <TableHeader>
                <TableRow className="border-[#1E2330] hover:bg-transparent bg-[#121519]">
                  <TableHead
                    className="text-[#7A8494]"
                    style={{ paddingLeft: "24px" }}
                  >
                    Report Name
                  </TableHead>
                  <TableHead className="text-[#7A8494]">Hotel</TableHead>
                  <TableHead className="text-[#7A8494]">Recipients</TableHead>
                  <TableHead className="text-[#7A8494]">Schedule</TableHead>
                  <TableHead className="text-[#7A8494] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingSchedules && (
                  <TableRow className="border-0">
                    <TableCell
                      colSpan={5}
                      className="text-center text-[#7A8494]"
                    >
                      <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                      Loading schedules...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoadingSchedules && scheduledReports.length === 0 && (
                  <TableRow className="border-0">
                    <TableCell
                      colSpan={5}
                      className="text-center text-[#7A8494]"
                    >
                      No schedules found.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoadingSchedules &&
                  scheduledReports.map((report) => (
                    <TableRow
                      key={report.id}
                      className="border-[#1E2330] hover:bg-[#1E2330]/30 transition-colors"
                    >
                      <TableCell
                        className="text-[#F3F5F7]"
                        style={{ paddingLeft: "24px" }}
                      >
                        {report.report_name}
                      </TableCell>
                      <TableCell className="text-[#F3F5F7]">
                        {getHotelName(report.property_id)}
                      </TableCell>
                      <TableCell className="text-[#7A8494] text-xs">
                        {report.recipients}
                      </TableCell>
                      <TableCell className="text-[#F3F5F7]">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-[#7A8494]" />
                          {formatScheduleText(report)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteSchedule(report.id)}
                          className="text-[#7A8494] hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </div>
        {/* --- [END NEW SECTION] --- */}

        {/* Preview Area (existing) */}
        <div>
          {/* Default State */}
          {!reportData && !isLoading && (
            <Card
              className="p-12 text-center"
              style={{
                backgroundColor: R.darkBand,
                border: `1px solid ${R.border}`,
              }}
            >
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-[#38C6BA]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-[#38C6BA]" />
                </div>
                <h3 className="text-[#F3F5F7] text-lg mb-2">
                  No Report Generated
                </h3>
                <p className="text-[#7A8494] text-sm">
                  Please select a hotel and date to preview the report
                </p>
              </div>
            </Card>
          )}

          {/* Loading State */}
          {isLoading && (
            <Card
              className="p-12 text-center"
              style={{
                backgroundColor: R.darkBand,
                border: `1px solid ${R.border}`,
              }}
            >
              <div className="max-w-md mx-auto">
                <Loader2 className="w-12 h-12 text-[#38C6BA] animate-spin mx-auto mb-4" />
                <p className="text-[#7A8494] text-sm">Generating report...</p>
              </div>
            </Card>
          )}

          {/* Data Loaded State */}
          {reportData && !isLoading && (
            <div className="space-y-4">
              {/* Dynamic Title */}
              <div className="text-center mb-6">
                <h2 className="text-white text-3xl mb-1">
                  {reportData.hotelName} - DAILY CHART
                </h2>
                <p className="text-[#7A8494] text-lg">
                  {formatDate(reportData.date).dayName}{" "}
                  {formatDate(reportData.date).formatted}
                </p>
              </div>

              {/* Summary Bar */}
              <Card
                className="p-6"
                style={{
                  backgroundColor: R.darkBand,
                  border: `1px solid ${R.border}`,
                }}
              >
                <div className="grid grid-cols-7 gap-4">
                  <div className="text-center">
                    <div className="text-[#7A8494] text-xs mb-1">Vacant</div>
                    <div className="text-[#F3F5F7] text-2xl">
                      {reportData.summary.vacant}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#7A8494] text-xs mb-1">Blocked</div>
                    <div
                      className={`text-2xl ${
                        reportData.summary.blocked > 0
                          ? "text-[#ef4444]"
                          : "text-[#F3F5F7]"
                      }`}
                    >
                      {reportData.summary.blocked}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#7A8494] text-xs mb-1">Sold</div>
                    <div className="text-[#F3F5F7] text-2xl">
                      {reportData.summary.sold}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#7A8494] text-xs mb-1">Occupancy</div>
                    {/* [FIX] Add toFixed(2) for occupancy in summary bar */}
                    <div className="text-[#F3F5F7] text-2xl">
                      {reportData.summary.occupancy.toFixed(2)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#7A8494] text-xs mb-1">RevPAR</div>
                    <div className="text-[#F3F5F7] text-2xl">
                      {formatCurrency(reportData.summary.revpar)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#7A8494] text-xs mb-1">ADR</div>
                    <div className="text-[#F3F5F7] text-2xl">
                      {formatCurrency(reportData.summary.adr)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#7A8494] text-xs mb-1">
                      Day Revenue
                    </div>
                    <div className="text-[#38C6BA] text-2xl">
                      {formatCurrency(reportData.summary.dayRevenue)}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Data Tabs (existing) */}
              <Tabs defaultValue="guests" className="w-full">
                <TabsList className="bg-[#111519] border border-[#1E2330] p-1">
                  <TabsTrigger
                    value="guests"
                    className="data-[state=active]:bg-[#121519] data-[state=active]:text-[#38C6BA] text-[#4E5868] hover:text-[#F3F5F7] transition-colors"
                  >
                    In-House Guests
                  </TabsTrigger>
                  <TabsTrigger
                    value="takings"
                    className="data-[state=active]:bg-[#121519] data-[state=active]:text-[#38C6BA] text-[#4E5868] hover:text-[#F3F5F7] transition-colors"
                  >
                    Daily Takings
                  </TabsTrigger>
                  <TabsTrigger
                    value="blocked"
                    className="data-[state=active]:bg-[#121519] data-[state=active]:text-[#38C6BA] text-[#4E5868] hover:text-[#F3F5F7] transition-colors"
                  >
                    Blocked Rooms
                  </TabsTrigger>
                </TabsList>

                {/* In-House Guests Tab */}
                <TabsContent value="guests" className="mt-4">
                  <Card
                    style={{
                      backgroundColor: R.darkBand,
                      border: `1px solid ${R.border}`,
                    }}
                  >
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#1E2330] hover:bg-transparent bg-[#121519]">
                            <TableHead className="text-[#4E5868] text-xs uppercase tracking-wider font-medium">
                              Room
                            </TableHead>
                            <TableHead className="text-[#4E5868] text-xs uppercase tracking-wider font-medium">
                              Pax
                            </TableHead>
                            <TableHead className="text-[#4E5868] text-xs uppercase tracking-wider font-medium">
                              Guest Name
                            </TableHead>
                            <TableHead className="text-[#4E5868] text-xs uppercase tracking-wider font-medium">
                              Total Rate
                            </TableHead>
                            <TableHead className="text-[#4E5868] text-xs uppercase tracking-wider font-medium">
                              {" "}
                              Arrival
                            </TableHead>
                            <TableHead className="text-[#4E5868] text-xs uppercase tracking-wider font-medium">
                              {" "}
                              Departure
                            </TableHead>
                            <TableHead className="text-[#4E5868] text-xs uppercase tracking-wider font-medium">
                              {" "}
                              Outstanding
                            </TableHead>
                            <TableHead className="text-[#4E5868] text-xs uppercase tracking-wider font-medium">
                              {" "}
                              Agency
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.inHouseGuests.map((guest, idx) => (
                            <TableRow
                              key={idx}
                              className="border-[#1E2330] hover:bg-[#1E2330]/30 transition-colors"
                            >
                              <TableCell className="text-[#F3F5F7]">
                                {guest.room}
                              </TableCell>
                              <TableCell className="text-[#F3F5F7]">
                                {guest.pax}
                              </TableCell>
                              <TableCell className="text-[#F3F5F7]">
                                {guest.guestName}
                              </TableCell>
                              <TableCell className="text-[#F3F5F7]">
                                {formatCurrency(guest.totalRate)}
                              </TableCell>
                              <TableCell className="text-[#F3F5F7]">
                                {guest.arrival}
                              </TableCell>
                              <TableCell className="text-[#F3F5F7]">
                                {guest.departure}
                              </TableCell>
                              {/* [FIX] More robust outstanding logic */}
                              <TableCell
                                className={
                                  parseFloat(String(guest.outstanding)) > 0
                                    ? "text-[#ef4444]"
                                    : "text-[#F3F5F7]"
                                }
                              >
                                {parseFloat(String(guest.outstanding)) > 0
                                  ? formatCurrency(guest.outstanding)
                                  : guest.guestName !== "---"
                                  ? formatCurrency(0)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-[#F3F5F7]">
                                {guest.agency}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                </TabsContent>

                {/* Daily Takings Tab */}
                <TabsContent value="takings" className="mt-4">
                  <Card
                    className="p-6"
                    style={{
                      backgroundColor: R.darkBand,
                      border: `1px solid ${R.border}`,
                    }}
                  >
                    <div className="max-w-md">
                      <div className="mb-6 pb-4 border-b border-[#1E2330]">
                        <div className="text-[#7A8494] text-sm mb-1">
                          Total Taken
                        </div>
                        <div className="text-[#38C6BA] text-3xl">
                          {formatCurrency(
                            getTotalTakings(reportData.dailyTakings)
                          )}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {Object.entries(reportData.dailyTakings).length > 0 ? (
                          Object.entries(reportData.dailyTakings).map(
                            ([method, amount]) => (
                              <div
                                key={method}
                                className="flex justify-between items-center"
                              >
                                <span className="text-[#7A8494] capitalize">
                                  {method.replace(/_/g, " ")}
                                </span>
                                <span className="text-[#F3F5F7]">
                                  {formatCurrency(amount)}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <p className="text-[#7A8494] text-sm">
                            No takings data for this day.
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                {/* Blocked Rooms Tab */}
                <TabsContent value="blocked" className="mt-4">
                  <Card
                    className="p-6"
                    style={{
                      backgroundColor: R.darkBand,
                      border: `1px solid ${R.border}`,
                    }}
                  >
                    {reportData.blockedRooms.length > 0 ? (
                      <div className="space-y-2">
                        {reportData.blockedRooms.map((room, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 py-2 px-3 bg-[#111519] rounded border border-[#1E2330]"
                          >
                            <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
                            <span className="text-[#F3F5F7]">{room}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-[#7A8494]">
                          No blocked rooms for this date
                        </p>
                      </div>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>{" "}
      {/* End of content wrapper */}
    </div>
  );
}
