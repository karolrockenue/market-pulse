import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { useState } from 'react';
import { Calendar, Clock, FileText, Mail, Package, CheckCircle2, Info, Zap, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
// [DEBUG] Import the entire module as a namespace to fix the ESM/CJS interop error
import * as fnsTz from 'date-fns-tz';
// [FIX] Removed the invalid '@2.0.3' version from the import path
import { toast } from 'sonner';

interface CreateScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (schedule: any) => void;
}

export function CreateScheduleModal({ open, onClose, onSave }: CreateScheduleModalProps) {
  const [reportPeriod, setReportPeriod] = useState('previous-week');
  const [frequency, setFrequency] = useState('weekly');
  const [dayOfWeek, setDayOfWeek] = useState('monday');
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [reportName, setReportName] = useState('');
  const [emailRecipients, setEmailRecipients] = useState('');
  const [csvFormat, setCsvFormat] = useState(true);
  const [excelFormat, setExcelFormat] = useState(false);

const handleSave = () => {
    // Validation
    if (!reportName.trim()) {
      toast.error('Please enter a report name');
      return;
    }
    if (!emailRecipients.trim()) {
      toast.error('Please enter at least one email recipient');
      return;
    }
    if (!csvFormat && !excelFormat) {
      toast.error('Please select at least one file format');
      return;
    }

// --- [NEW] Timezone Conversion Logic ---
    // 1. Get the user's local time string from state (e.g., "11:50")
    const localTime = timeOfDay;
    // 2. Get the user's browser timezone (e.g., "Europe/Warsaw")
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // 3. Get today's date as a string in YYYY-MM-DD format
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const localDateString = `${year}-${month}-${day}`;

    // 4. Create a full "wall time" string (e.g., "2025-10-21T11:50:00")
    // This is explicitly what the user sees and intends.
    const localDateTimeString = `${localDateString}T${localTime}:00`;

    // 5. Use 'fromZonedTime' (the function fixed in the changelog)
    // to parse that wall time *in its specific timezone* into a true Date object.
    // This object (zonedDate) now correctly represents 2025-10-21T09:50:00.000Z
    const zonedDate = fnsTz.fromZonedTime(localDateTimeString, localTz);

 // 6. Format that correct Date object into a UTC time string.
    // [FIX] Replace 'fnsTz.format' with 'fnsTz.formatInTimeZone'.
    // The 'format' function was incorrectly ignoring the { timeZone: 'UTC' } option
    // and formatting the date in local time.
    // 'formatInTimeZone' is the explicit function for this exact task.
    const utcTime = fnsTz.formatInTimeZone(zonedDate, 'UTC', 'HH:mm');
    // --- End of Conversion Logic ---

    onSave({
      reportPeriod,
      frequency,
      dayOfWeek,
      timeOfDay: utcTime, // [MODIFIED] Pass the converted UTC time string
      reportName,
      emailRecipients,
      formats: { csv: csvFormat, excel: excelFormat },
    });
    
// [FIX] Removed the toast.success() call from here.
    // The toast is now handled in App.tsx *after* the API call succeeds.
    onClose();
  };

  // Generate preview text
  const getFrequencyText = () => {
    if (frequency === 'daily') return 'Daily';
    if (frequency === 'weekly') {
      const days: Record<string, string> = {
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
        sunday: 'Sunday'
      };
      return `Every ${days[dayOfWeek]}`;
    }
    return 'Monthly (1st)';
  };

  const getPeriodLabel = () => {
    const periods: Record<string, string> = {
      'previous-week': 'Previous Week',
      'current-week': 'Current Week',
      'previous-month': 'Previous Month',
      'current-month': 'Current Month'
    };
    return periods[reportPeriod];
  };

  const getRecipientCount = () => {
    if (!emailRecipients.trim()) return 0;
    return emailRecipients.split(',').filter(e => e.trim()).length;
  };

  const getFormats = () => {
    const formats = [];
    if (csvFormat) formats.push('CSV');
    if (excelFormat) formats.push('Excel');
    return formats.length > 0 ? formats.join(' + ') : 'None';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
{/* [FIX] Moved max-width, max-height, and overflow to inline styles.
    - The Tailwind class 'max-h-[90vh]' is an arbitrary value and is not
    - in the static CSS build, so it must be applied as an inline style.
*/}
      <DialogContent 
        className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]" 
        style={{ 
          maxWidth: '1200px',
          maxHeight: '90vh', 
          overflowY: 'auto' 
        }}
      >
        <DialogHeader className="pb-4">
          <DialogTitle className="text-[#faff6a] text-2xl flex items-center gap-2">
            <Zap className="w-6 h-6" />
            Create Automated Report Schedule
          </DialogTitle>
          <DialogDescription className="text-[#9ca3af] text-base mt-1">
            Set up automatic report delivery to your inbox—configure once, receive forever
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 gap-8">
          {/* Left Side - Configuration */}
          <div className="col-span-3 space-y-5">
            {/* Step 1: Report Details */}
            <div className="bg-[#1f1f1c] rounded-lg p-5 border border-[#3a3a35]">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-full bg-[#faff6a] text-[#1f1f1c] flex items-center justify-center">1</div>
                <h3 className="text-[#e5e5e5] text-lg">Report Details</h3>
                <FileText className="w-5 h-5 text-[#faff6a] ml-auto" />
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[#9ca3af] text-sm mb-2 block">
                    Report Name
                  </label>
                  <Input
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="e.g., Weekly Performance Summary"
                    className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]"
                  />
                {/* [FIX] Increased top margin from mt-1.5 to mt-2 */}
                  <p className="text-[#6b7280] text-xs mt-2">This appears in email subject and filename</p>
                </div>

                <div>
                  <label className="text-[#9ca3af] text-sm mb-2 block">
                    Report Period
                  </label>
                  <Select value={reportPeriod} onValueChange={setReportPeriod}>
                    <SelectTrigger className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
                      <SelectItem value="previous-week">Previous Week (Mon-Sun)</SelectItem>
                      <SelectItem value="current-week">Current Week (Mon-Sun)</SelectItem>
                      <SelectItem value="previous-month">Previous Month (Full)</SelectItem>
                      <SelectItem value="current-month">Current Month (MTD)</SelectItem>
                    </SelectContent>
                  </Select>
               {/* [FIX] Increased top margin from mt-1.5 to mt-2 */}
                  <p className="text-[#6b7280] text-xs mt-2">Which time period to include</p>
                </div>
              </div>
            </div>

            {/* Step 2: Schedule */}
            <div className="bg-[#1f1f1c] rounded-lg p-5 border border-[#3a3a35]">
         {/* [FIX] Increased bottom margin for better spacing */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-[#faff6a] text-[#1f1f1c] flex items-center justify-center">2</div>
                <h3 className="text-[#e5e5e5] text-lg">Delivery Schedule</h3>
                <Calendar className="w-5 h-5 text-[#faff6a] ml-auto" />
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[#9ca3af] text-sm mb-2 block">
                      Frequency
                    </label>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[#9ca3af] text-sm mb-2 block flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Time
                    </label>
              <Input
                      type="time"
                      value={timeOfDay}
                      onChange={(e) => setTimeOfDay(e.target.value)}
                      className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]"
                      // [FIX] Add step="300" (300 seconds = 5 minutes)
                      // This forces the time input to align with the 5-minute cron job in vercel.json.
                      step="300"
                    />
                    {/* [NEW] Add helper text to explain the 5-minute intervals */}
                    <p className="text-[#6b7280] text-xs mt-2">
                      Time is in your local timezone and can be set in 5-minute intervals.
                    </p>
                  </div>
                </div>

                {frequency === 'weekly' && (
                  <div>
                    <label className="text-[#9ca3af] text-sm mb-2 block">
                      Day of Week
                    </label>
                    <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                      <SelectTrigger className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
                        <SelectItem value="monday">Monday</SelectItem>
                        <SelectItem value="tuesday">Tuesday</SelectItem>
                        <SelectItem value="wednesday">Wednesday</SelectItem>
                        <SelectItem value="thursday">Thursday</SelectItem>
                        <SelectItem value="friday">Friday</SelectItem>
                        <SelectItem value="saturday">Saturday</SelectItem>
                        <SelectItem value="sunday">Sunday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Recipients */}
            <div className="bg-[#1f1f1c] rounded-lg p-5 border border-[#3a3a35]">
          {/* [FIX] Increased bottom margin for better spacing */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-[#faff6a] text-[#1f1f1c] flex items-center justify-center">3</div>
                <h3 className="text-[#e5e5e5] text-lg">Recipients</h3>
                <Mail className="w-5 h-5 text-[#faff6a] ml-auto" />
              </div>
              
              <div>
                <label className="text-[#9ca3af] text-sm mb-2 block">
                  Email Addresses
                </label>
                <Input
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="manager@hotel.com, owner@hotel.com"
                  className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]"
                />
         {/* [FIX] Increased top margin from mt-1.5 to mt-2 */}
                <p className="text-[#6b7280] text-xs mt-2">
                  Separate multiple emails with commas
                </p>
                {getRecipientCount() > 0 && (
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs border-[#faff6a] text-[#faff6a]">
                      {getRecipientCount()} recipient{getRecipientCount() > 1 ? 's' : ''}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Step 4: Format */}
            <div className="bg-[#1f1f1c] rounded-lg p-5 border border-[#3a3a35]">
         {/* [FIX] Increased bottom margin for better spacing */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-[#faff6a] text-[#1f1f1c] flex items-center justify-center">4</div>
                <h3 className="text-[#e5e5e5] text-lg">File Format</h3>
                <Package className="w-5 h-5 text-[#faff6a] ml-auto" />
              </div>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded border border-[#3a3a35] hover:border-[#faff6a]/50 transition-colors">
                  <Checkbox
                    checked={csvFormat}
                    onCheckedChange={(checked) => setCsvFormat(checked as boolean)}
                    className="border-[#3a3a35] data-[state=checked]:bg-[#faff6a] data-[state=checked]:border-[#faff6a]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[#e5e5e5]">CSV Format</span>
                      <Badge variant="outline" className="text-xs border-[#3a3a35] text-[#9ca3af]">.csv</Badge>
                    </div>
                    <p className="text-[#6b7280] text-xs">Excel, Google Sheets compatible</p>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded border border-[#3a3a35] hover:border-[#faff6a]/50 transition-colors">
                  <Checkbox
                    checked={excelFormat}
                    onCheckedChange={(checked) => setExcelFormat(checked as boolean)}
                    className="border-[#3a3a35] data-[state=checked]:bg-[#faff6a] data-[state=checked]:border-[#faff6a]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[#e5e5e5]">Excel Format</span>
                      <Badge variant="outline" className="text-xs border-[#3a3a35] text-[#9ca3af]">.xlsx</Badge>
                    </div>
                    <p className="text-[#6b7280] text-xs">Native Excel with formatting</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Side - Live Preview */}
          <div className="col-span-2">
            <div className="bg-gradient-to-br from-[#faff6a]/10 to-[#faff6a]/5 rounded-lg p-6 border border-[#faff6a]/30 sticky top-0">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="w-5 h-5 text-[#faff6a]" />
                <h3 className="text-[#faff6a] text-lg">Live Preview</h3>
              </div>

              <div className="space-y-5">
                {/* Preview Card */}
                <div className="bg-[#1f1f1c] rounded-lg p-4 border border-[#3a3a35]">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[#9ca3af] text-xs mb-1.5">Report Name</p>
                      <p className="text-[#e5e5e5]">
                        {reportName || <span className="text-[#6b7280] italic">Not set</span>}
                      </p>
                    </div>

                    <Separator className="bg-[#3a3a35]" />

                    <div>
                      <p className="text-[#9ca3af] text-xs mb-2">Schedule</p>
                      <div className="flex items-center gap-2 text-[#e5e5e5] mb-1.5">
                        <Calendar className="w-4 h-4 text-[#faff6a]" />
                        <span>{getFrequencyText()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#e5e5e5]">
                        <Clock className="w-4 h-4 text-[#faff6a]" />
                        <span>{timeOfDay}</span>
                      </div>
                    </div>

                    <Separator className="bg-[#3a3a35]" />

                    <div>
                      <p className="text-[#9ca3af] text-xs mb-1.5">Report Data</p>
                      <p className="text-[#e5e5e5]">{getPeriodLabel()}</p>
                    </div>

                    <Separator className="bg-[#3a3a35]" />

                    <div>
                      <p className="text-[#9ca3af] text-xs mb-1.5">Recipients</p>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-[#faff6a]" />
                        <p className="text-[#e5e5e5]">
                          {getRecipientCount() > 0 ? (
                            `${getRecipientCount()} recipient${getRecipientCount() > 1 ? 's' : ''}`
                          ) : (
                            <span className="text-[#6b7280] italic">Not set</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <Separator className="bg-[#3a3a35]" />

                    <div>
                      <p className="text-[#9ca3af] text-xs mb-1.5">File Formats</p>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#faff6a]" />
                        <p className="text-[#e5e5e5]">
                          {csvFormat || excelFormat ? (
                            getFormats()
                          ) : (
                            <span className="text-[#6b7280] italic">Not set</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* What Happens Next */}
                <div className="bg-[#2C2C2C] rounded-lg p-4 border border-[#3a3a35]">
                  <h4 className="text-[#e5e5e5] mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#faff6a]" />
                    What happens next?
                  </h4>
                  <div className="space-y-2.5 text-sm text-[#9ca3af]">
                    <div className="flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 text-[#faff6a] flex-shrink-0 mt-0.5" />
                      <span>Reports automatically generated & sent</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 text-[#faff6a] flex-shrink-0 mt-0.5" />
                      <span>Pause or edit schedule anytime</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 text-[#faff6a] flex-shrink-0 mt-0.5" />
                      <span>All recipients get same report</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-[#3a3a35] mt-6" />

        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]"
          >
            <Zap className="w-4 h-4 mr-2" />
            Create Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
