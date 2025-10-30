import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
// [DEBUG] Import the entire module as a namespace to fix the ESM/CJS interop error
import * as fnsTz from 'date-fns-tz';


// [FIX] Updated interface to match the database schema


// [FIX] Updated interface to match the database schema
interface Schedule {
  id: string; // [FIX] Changed from 'schedule_id' to 'id' to match the live API data
  report_name: string; // Changed from name
  property_name: string; // Changed from property
  frequency: string;
  recipients: string[]; // Changed from string to string[]
  time_of_day: string; // [NEW] Add the time_of_day property
}

interface ManageSchedulesModalProps {
  open: boolean;
  onClose: () => void;
  schedules: Schedule[];
  onDelete: (id: string) => void;
}

export function ManageSchedulesModal({ open, onClose, schedules, onDelete }: ManageSchedulesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
<DialogContent 
  className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]" 
  style={{ maxWidth: '1024px' }} // [FIX] Reduced width from 1680px to a more reasonable 1024px
>
        <DialogHeader>
          <DialogTitle className="text-[#faff6a] text-xl">Manage Schedules</DialogTitle>
          <DialogDescription className="text-[#9ca3af]">
            View and manage all scheduled reports
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {schedules.length === 0 ? (
            <div className="text-center py-12 text-[#9ca3af]">
              No scheduled reports found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
 <thead>
                  <tr className="border-b border-[#3a3a35]">
                    <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">
                      Report Name
                    </th>
                    <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">
                      Property
                    </th>
                    <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">
                      Frequency
                    </th>
                    {/* [NEW] Added Time column */}
                    <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">
                      Time (Local)
                    </th>
                    <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">
                      Recipients
                    </th>
                    <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
</thead>
                <tbody>
                  {/* [FIX] Use the correct 'id' property for the key */}
                  {schedules.map((schedule) => {

                    // --- [NEW] Timezone Conversion Logic ---
                    let localTime = 'N/A';
                    if (schedule.time_of_day) {
                      try {
                        // 1. Get user's local timezone
                        const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                        // 2. Parse the UTC time string (e.g., "07:55")
                        const [hours, minutes] = schedule.time_of_day.split(':').map(Number);
                        const today = new Date();
                        const utcDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hours, minutes));
// 3. Convert the UTC date to a local time string (e.g., "09:55")
              // [DEBUG] Use the correct v3 function name 'toZonedTime'
                        localTime = format(fnsTz.toZonedTime(utcDate, localTz), 'HH:mm');
                      } catch (e) {
                        console.error("Error parsing schedule time:", e);
                        localTime = schedule.time_of_day; // Fallback to raw string
                      }
                    }
                    // --- End of Conversion Logic ---

                    return (
                    <tr key={schedule.id} className="border-b border-[#3a3a35] hover:bg-[#3a3a35]/30 transition-colors">
                      {/* [FIX] Use report_name */}
                      <td className="px-4 py-3 text-[#e5e5e5] text-sm">{schedule.report_name}</td>
                      {/* [FIX] Use property_name and add a fallback */}
                      <td className="px-4 py-3 text-[#9ca3af] text-sm">{schedule.property_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-[#9ca3af] text-sm capitalize">{schedule.frequency}</td>
                      {/* [NEW] Display the converted localTime */}
                      <td className="px-4 py-3 text-[#9ca3af] text-sm">{localTime}</td>
                      {/* [FIX] Handle recipients as either an array (new) or a string (old data) */}
                      <td className="px-4 py-3 text-[#9ca3af] text-sm">
                        {Array.isArray(schedule.recipients) 
                          ? schedule.recipients.join(', ') 
                          : schedule.recipients || ''} 
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          // [FIX] Pass the correct 'id' to the onDelete function
                          onClick={() => onDelete(schedule.id)}
                          className="text-[#ef4444] hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                   );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-[#3a3a35]">
          <Button
            onClick={onClose}
            className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}