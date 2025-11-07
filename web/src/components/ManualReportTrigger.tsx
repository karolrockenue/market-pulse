import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { useState } from 'react';
import { Send, Loader2, CheckCircle } from 'lucide-react';
// Import toast
import { toast } from 'sonner@2.0.3';

// Define the shape of the report object from the API
interface Report {
  report_id: string; // The backend returns UUIDs as strings
  report_name: string;
  property_name: string;
}

// Define the props for the component
interface ManualReportTriggerProps {
  reports: Report[]; // Accept the list of reports
}

// Accept the reports prop
export function ManualReportTrigger({ reports }: ManualReportTriggerProps) {
  const [selectedReport, setSelectedReport] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');


const handleSendReport = async () => {
    // Check if a report is actually selected
    if (!selectedReport) {
      toast.warning('Please select a report first.');
      return;
    }
    
    setStatus('sending'); // Update button state
    const toastId = toast.loading('Triggering report generation...');

    try {
      // Call the backend endpoint
      const response = await fetch('/api/admin/run-scheduled-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selectedReport }), // Send the selected report_id
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to trigger report');
      }

      // Show success toast with the message from the backend
      toast.success(result.message || 'Report sent successfully!', { id: toastId });
      setStatus('sent'); // Update button state briefly
      setTimeout(() => setStatus('idle'), 2000); // Reset button after 2s

    } catch (error: any) {
      // Show error toast
      toast.error(`Error: ${error.message}`, { id: toastId });
      setStatus('idle'); // Reset button immediately on error
    }
  };

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-5">
      <h2 className="text-[#e5e5e5] text-lg mb-4">Manual Report Trigger</h2>
      
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
            Select Report
          </label>
          <Select value={selectedReport} onValueChange={setSelectedReport}>
            <SelectTrigger className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]">
              <SelectValue placeholder="Choose a scheduled report..." />
            </SelectTrigger>
     <SelectContent className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
              {/* Check if reports have loaded */}
              {reports.length === 0 ? (
                <SelectItem value="loading" disabled>Loading reports...</SelectItem>
              ) : (
                // Map over the reports prop
                reports.map(report => (
                  // Use report_id as the value
                  <SelectItem key={report.report_id} value={report.report_id}>
                    {/* Display combined name like in admin.mjs */}
                    {report.property_name} - {report.report_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleSendReport}
          disabled={!selectedReport || status === 'sending'}
          className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a] h-10 px-6"
        >
          {status === 'sending' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : status === 'sent' ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Sent!
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send Now
            </>
          )}
    </Button>
      </div>
    </div> // <-- Add this closing div
  ); // <-- Add the closing parenthesis for return if needed (it wasn't in your snippet but should be there)
} // <-- Add this closing brace for the function

