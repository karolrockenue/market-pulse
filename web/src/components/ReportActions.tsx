import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Download, Clock, ChevronDown } from 'lucide-react';

interface ReportActionsProps {
  onExportCSV: () => void;
  onExportExcel: () => void;
  onCreateSchedule: () => void;
  onManageSchedules: () => void;
}

export function ReportActions({
  onExportCSV,
  onExportExcel,
  onCreateSchedule,
  onManageSchedules,
}: ReportActionsProps) {
  return (
    <div className="flex gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] h-10"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
          <DropdownMenuItem 
            onClick={onExportCSV}
            className="hover:bg-[#3a3a35] cursor-pointer"
          >
            Download as CSV
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={onExportExcel}
            className="hover:bg-[#3a3a35] cursor-pointer"
          >
            Download as Excel (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] h-10"
          >
            <Clock className="w-4 h-4 mr-2" />
            Schedule
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
          <DropdownMenuItem 
            onClick={onCreateSchedule}
            className="hover:bg-[#3a3a35] cursor-pointer"
          >
            Create New Schedule
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={onManageSchedules}
            className="hover:bg-[#3a3a35] cursor-pointer"
          >
            Manage Schedules
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
