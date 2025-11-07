export function MarketKPIGrid() {
  const kpis = [
    { label: 'Market Occupancy', value: '72.5%', change: 5.2, trend: 'up' as const },
    { label: 'Market ADR', value: '$185', change: 8.1, trend: 'up' as const },
    { label: 'Market RevPAR', value: '$134', change: 12.3, trend: 'up' as const },
    { label: 'Total Properties', value: '175', change: 3.5, trend: 'up' as const },
    { label: 'Available Rooms', value: '8,420', change: 2.1, trend: 'up' as const },
    { label: 'Avg LOS', value: '2.8 days', change: -0.3, trend: 'down' as const },
  ];

  return (
    <div className="grid grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-3">
          <div className="text-[#9ca3af] text-[10px] mb-1 uppercase tracking-wider">{kpi.label}</div>
          <div className="text-white text-lg mb-1">{kpi.value}</div>
          <div className={`text-[10px] ${kpi.trend === 'up' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            {kpi.trend === 'up' ? '↑' : '↓'} {Math.abs(kpi.change)}% YoY
          </div>
        </div>
      ))}
    </div>
  );
}
