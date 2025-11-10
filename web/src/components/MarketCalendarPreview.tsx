import { PartyPopper, TrendingUp } from 'lucide-react';

interface DayData {
  date: Date;
  dateString: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  availability: { available: number; total: number };
  demandIndex: number;
  priceIndex: number;
  events: string[];
  hotelOccupancy: number;
  hotelRoomsUnsold: number;
  hotelADR: number;
  hotelRevenue: number;
}

export function MarketCalendarPreview() {
  const getDemandColor = (demandIndex: number) => {
    if (demandIndex >= 75) return '#ef4444';
    if (demandIndex >= 50) return '#faff6a';
    return '#10b981';
  };

  const getDemandLabel = (demandIndex: number) => {
    if (demandIndex >= 75) return 'High';
    if (demandIndex >= 50) return 'Medium';
    return 'Low';
  };

  const generateCalendarData = (year: number, month: number): DayData[] => {
    const data: DayData[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const eventPool = [
      'City Marathon',
      'Music Festival',
      'Tech Conference',
      'Food & Wine Expo',
      'Sports Championship',
    ];

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const isCurrentMonth = currentDate.getMonth() === month;
      
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      const baseDemand = isWeekend ? 65 : 45;
      const variance = Math.random() * 30;
      const demandIndex = Math.min(100, baseDemand + variance);
      
      const hasEvent = Math.random() > 0.85;
      const eventDemand = hasEvent ? 25 : 0;
      const finalDemand = Math.min(100, demandIndex + eventDemand);
      
      const events = hasEvent ? [eventPool[Math.floor(Math.random() * eventPool.length)]] : [];
      
      const totalRooms = 250;
      const availableRooms = Math.floor((100 - finalDemand) * totalRooms / 100);
      
      const basePrice = 220;
      const priceMultiplier = 1 + (finalDemand / 100) * 0.6;
      const priceIndex = Math.round(basePrice * priceMultiplier);
      
      const hotelOccupancy = Math.min(100, finalDemand + (Math.random() * 15 - 7.5));
      const hotelRoomsUnsold = Math.floor(totalRooms * (1 - hotelOccupancy / 100));
      const hotelADR = Math.round(priceIndex * (0.95 + Math.random() * 0.1));
      const hotelRevenue = Math.round((totalRooms - hotelRoomsUnsold) * hotelADR);

      data.push({
        date: currentDate,
        dateString: currentDate.toISOString().split('T')[0],
        dayOfMonth: currentDate.getDate(),
        isCurrentMonth,
        availability: { available: availableRooms, total: totalRooms },
        demandIndex: finalDemand,
        priceIndex,
        events,
        hotelOccupancy,
        hotelRoomsUnsold,
        hotelADR,
        hotelRevenue,
      });
    }

    return data;
  };

  const currentDate = new Date();
  const calendarData = generateCalendarData(currentDate.getFullYear(), currentDate.getMonth());
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-[#252521] rounded-xl border border-[#3a3a35] overflow-hidden shadow-2xl">
      {/* Header - Static */}
      <div className="p-6 border-b border-[#3a3a35]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[#e5e5e5] text-xl mb-1">Market Calendar</h2>
            <p className="text-[#9ca3af] text-sm">Forward-looking demand and pricing forecast</p>
          </div>
          
          <div className="text-[#e5e5e5] px-6 py-2 bg-[#2C2C2C] rounded border border-[#3a3a35]">
            {monthName}
          </div>
        </div>

        {/* Static View Mode Indicator */}
        <div className="inline-flex items-center gap-2 bg-[#faff6a] text-[#252521] px-4 py-2 rounded">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm">Market Demand View</span>
        </div>
      </div>

      {/* Calendar Grid - Static, non-interactive */}
      <div className="p-6">
        {/* Legend */}
        <div className="flex items-center justify-end gap-4 mb-4 text-xs text-[#9ca3af]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }} />
            <span>Low Demand</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#faff6a' }} />
            <span>Medium Demand</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
            <span>High Demand</span>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-[#9ca3af] text-xs py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days - completely static */}
        <div className="grid grid-cols-7 gap-2">
          {calendarData.map((day, idx) => {
            const color = getDemandColor(day.demandIndex);
            const label = getDemandLabel(day.demandIndex);
            
            return (
              <div
                key={idx}
                className={`aspect-square rounded-lg border p-2 relative ${
                  day.isCurrentMonth
                    ? 'border-[#3a3a35] bg-[#1f1f1c]'
                    : 'border-[#3a3a35]/30 bg-[#1a1a18]/50 opacity-50'
                }`}
                style={{
                  borderLeftWidth: '3px',
                  borderLeftColor: day.isCurrentMonth ? color : '#3a3a35',
                }}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-1">
                    <span
                      className={`text-sm ${
                        day.isCurrentMonth ? 'text-[#e5e5e5]' : 'text-[#6b7280]'
                      }`}
                    >
                      {day.dayOfMonth}
                    </span>
                    {day.events.length > 0 && day.isCurrentMonth && (
                      <PartyPopper className="w-3 h-3 text-[#faff6a]" />
                    )}
                  </div>
                  
                  {day.isCurrentMonth && (
                    <>
                      <div className="text-xs mb-1" style={{ color }}>
                        {label}
                      </div>
                      <div className="text-xs text-[#9ca3af]">
                        ${day.priceIndex}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer note */}
      <div className="px-6 py-4 bg-[#1a1a18] border-t border-[#3a3a35]">
        <p className="text-xs text-[#9ca3af] text-center">
          Interactive calendar with detailed insights available in the full application
        </p>
      </div>
    </div>
  );
}
