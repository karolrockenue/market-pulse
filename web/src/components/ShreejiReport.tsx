import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useState } from 'react';
import { CalendarIcon, FileText, Download } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

// Helper function to format date
const formatDate = (date: Date) => {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const day = days[date.getDay()];
  const dateStr = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day} ${dateStr}-${month}-${year}`;
};

const formatDatePicker = (date: Date) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

export function ShreejiReport() {
  const [selectedHotel, setSelectedHotel] = useState('');
  const [reportDate, setReportDate] = useState<Date>();
  const [reportGenerated, setReportGenerated] = useState(false);

  const hotels = [
    { id: 'jade', name: 'The Jade Hotel' },
    { id: 'grand-plaza', name: 'Grand Plaza Hotel' },
    { id: 'seaside', name: 'Seaside Resort' },
  ];

  const guestData = [
    { room: '101', pax: 2, name: 'Smith, John', rate: 185.00, arrival: '14-10-2025', departure: '18-10-2025', outstanding: 740.00, agency: 'Direct' },
    { room: '203', pax: 1, name: 'Johnson, Sarah', rate: 165.00, arrival: '15-10-2025', departure: '17-10-2025', outstanding: 330.00, agency: 'Booking.com' },
    { room: '305', pax: 2, name: 'Williams, Robert', rate: 210.00, arrival: '13-10-2025', departure: '20-10-2025', outstanding: 1470.00, agency: 'Expedia' },
    { room: '412', pax: 3, name: 'Brown, Jennifer', rate: 245.00, arrival: '16-10-2025', departure: '19-10-2025', outstanding: 735.00, agency: 'Direct' },
    { room: '508', pax: 2, name: 'Davis, Michael', rate: 195.00, arrival: '14-10-2025', departure: '21-10-2025', outstanding: 1365.00, agency: 'Agoda' },
  ];

  const performanceSummary = {
    vacant: 12,
    blocked: 3,
    sold: 35,
    occupancy: 70.0,
    revpar: 136.5,
    adr: 195.0,
    dayRevenue: 6825.00,
  };

  const dailyUpsells = [
    { item: 'Breakfast', amount: 450.00 },
    { item: 'Spa Services', amount: 320.00 },
    { item: 'Room Upgrade', amount: 180.00 },
    { item: 'Late Checkout', amount: 95.00 },
  ];

  const dailyTakings = [
    { method: 'Cash', amount: 1250.00 },
    { method: 'Card', amount: 4875.00 },
    { method: 'Bank Transfer', amount: 700.00 },
  ];

  const handleGenerateReport = () => {
    if (!selectedHotel || !reportDate) {
      toast.error('Please select hotel and date');
      return;
    }
    setReportGenerated(true);
    toast.success('Report generated successfully');
  };

  const selectedHotelName = hotels.find(h => h.id === selectedHotel)?.name || '';
  const formattedDate = reportDate ? formatDate(reportDate) : '';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-6 h-6 text-[#faff6a]" />
          <h1 className="text-white text-2xl">Shreeji Report</h1>
        </div>
        <p className="text-[#9ca3af] text-sm">
          Pulls a list of all in-house guests with their current balances for the previous day
        </p>
      </div>

      {/* Report Controls */}
      <div className="bg-[#262626] rounded border border-[#3a3a35] p-5 mb-6">
        <h2 className="text-[#e5e5e5] text-lg mb-4">Report Configuration</h2>
        
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
              Select Hotel
            </label>
            <Select value={selectedHotel} onValueChange={setSelectedHotel}>
              <SelectTrigger className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]">
                <SelectValue placeholder="Choose a hotel..." />
              </SelectTrigger>
              <SelectContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
                {hotels.map(hotel => (
                  <SelectItem key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
              Report Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35]"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {reportDate ? formatDatePicker(reportDate) : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-[#262626] border-[#3a3a35]" align="start">
                <Calendar
                  mode="single"
                  selected={reportDate}
                  onSelect={setReportDate}
                  initialFocus
                  className="bg-[#262626] text-[#e5e5e5]"
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button
            onClick={handleGenerateReport}
            disabled={!selectedHotel || !reportDate}
            className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a] h-10 px-6"
          >
            Generate Report
          </Button>

          {reportGenerated && (
            <Button
              variant="outline"
              className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] h-10 px-6"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Main Report Display */}
      {reportGenerated && (
        <div className="space-y-6">
          {/* Report Header */}
          <div className="bg-[#262626] rounded border border-[#3a3a35] p-6 text-center">
            <h2 className="text-[#faff6a] text-2xl mb-2">
              {selectedHotelName} - DAILY CHART
            </h2>
            <p className="text-[#e5e5e5] text-lg">{formattedDate}</p>
          </div>

          {/* Guest List Table */}
          <div className="bg-[#262626] rounded border border-[#3a3a35] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#3a3a35]">
              <h3 className="text-[#e5e5e5] text-lg">In-House Guests</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#3a3a35] bg-[#1f1f1c]">
                    <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Room</th>
                    <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Pax</th>
                    <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Guest Name</th>
                    <th className="px-4 py-3 text-right text-[#9ca3af] text-xs uppercase tracking-wider">Total Rate</th>
                    <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Arrival</th>
                    <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Departure</th>
                    <th className="px-4 py-3 text-right text-[#9ca3af] text-xs uppercase tracking-wider">Outstanding</th>
                    <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Agency</th>
                  </tr>
                </thead>
                <tbody>
                  {guestData.map((guest, index) => (
                    <tr key={index} className="border-b border-[#3a3a35] hover:bg-[#3a3a35]/30 transition-colors">
                      <td className="px-4 py-3 text-[#faff6a] text-sm">{guest.room}</td>
                      <td className="px-4 py-3 text-[#e5e5e5] text-sm">{guest.pax}</td>
                      <td className="px-4 py-3 text-[#e5e5e5] text-sm">{guest.name}</td>
                      <td className="px-4 py-3 text-white text-sm text-right">${guest.rate.toFixed(2)}</td>
                      <td className="px-4 py-3 text-[#9ca3af] text-sm">{guest.arrival}</td>
                      <td className="px-4 py-3 text-[#9ca3af] text-sm">{guest.departure}</td>
                      <td className="px-4 py-3 text-white text-sm text-right">${guest.outstanding.toFixed(2)}</td>
                      <td className="px-4 py-3 text-[#9ca3af] text-sm">{guest.agency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Performance Summary Bar */}
          <div className="bg-[#262626] rounded border-2 border-[#faff6a]/30 p-4">
            <h3 className="text-[#faff6a] text-sm mb-3 uppercase tracking-wider">Daily Performance Summary</h3>
            <div className="grid grid-cols-7 gap-4">
              <div className="bg-[#1f1f1c] rounded p-3 text-center">
                <div className="text-[#9ca3af] text-xs mb-1">VACANT</div>
                <div className="text-white text-xl">{performanceSummary.vacant}</div>
              </div>
              <div className="bg-[#1f1f1c] rounded p-3 text-center">
                <div className="text-[#9ca3af] text-xs mb-1">BLOCKED</div>
                <div className="text-white text-xl">{performanceSummary.blocked}</div>
              </div>
              <div className="bg-[#1f1f1c] rounded p-3 text-center">
                <div className="text-[#9ca3af] text-xs mb-1">SOLD</div>
                <div className="text-white text-xl">{performanceSummary.sold}</div>
              </div>
              <div className="bg-[#1f1f1c] rounded p-3 text-center">
                <div className="text-[#9ca3af] text-xs mb-1">OCCUPANCY</div>
                <div className="text-[#10b981] text-xl">{performanceSummary.occupancy}%</div>
              </div>
              <div className="bg-[#1f1f1c] rounded p-3 text-center">
                <div className="text-[#9ca3af] text-xs mb-1">RevPAR</div>
                <div className="text-white text-xl">${performanceSummary.revpar}</div>
              </div>
              <div className="bg-[#1f1f1c] rounded p-3 text-center">
                <div className="text-[#9ca3af] text-xs mb-1">ADR</div>
                <div className="text-white text-xl">${performanceSummary.adr}</div>
              </div>
              <div className="bg-[#1f1f1c] rounded p-3 text-center">
                <div className="text-[#9ca3af] text-xs mb-1">DAY REVENUE</div>
                <div className="text-[#faff6a] text-xl">${performanceSummary.dayRevenue.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Ancillary Data Sections */}
          <div className="grid grid-cols-2 gap-6">
            {/* Daily Upsells */}
            <div className="bg-[#262626] rounded border border-[#3a3a35] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#3a3a35]">
                <h3 className="text-[#e5e5e5] text-lg">Daily Upsells</h3>
              </div>
              <div className="p-5">
                <table className="w-full">
                  <tbody>
                    {dailyUpsells.map((upsell, index) => (
                      <tr key={index} className="border-b border-[#3a3a35] last:border-0">
                        <td className="py-3 text-[#e5e5e5] text-sm">{upsell.item}</td>
                        <td className="py-3 text-white text-sm text-right">${upsell.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[#faff6a]/30">
                      <td className="py-3 text-[#faff6a] text-sm">Total Upsells</td>
                      <td className="py-3 text-[#faff6a] text-sm text-right">
                        ${dailyUpsells.reduce((sum, u) => sum + u.amount, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Takings Summary */}
            <div className="bg-[#262626] rounded border border-[#3a3a35] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#3a3a35]">
                <h3 className="text-[#e5e5e5] text-lg">Daily Takings Summary</h3>
              </div>
              <div className="p-5">
                <table className="w-full">
                  <tbody>
                    {dailyTakings.map((taking, index) => (
                      <tr key={index} className="border-b border-[#3a3a35] last:border-0">
                        <td className="py-3 text-[#e5e5e5] text-sm">{taking.method}</td>
                        <td className="py-3 text-white text-sm text-right">${taking.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[#faff6a]/30">
                      <td className="py-3 text-[#faff6a] text-sm">Takings Total</td>
                      <td className="py-3 text-[#faff6a] text-sm text-right">
                        ${dailyTakings.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
