import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function DemandForecast() {
  const data = [
    { month: 'Jan', actual: 72, forecast: 74 },
    { month: 'Feb', actual: 68, forecast: 70 },
    { month: 'Mar', actual: 75, forecast: 76 },
    { month: 'Apr', actual: null, forecast: 78 },
    { month: 'May', actual: null, forecast: 82 },
    { month: 'Jun', actual: null, forecast: 85 },
  ];

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-4">
      <h2 className="text-[#e5e5e5] text-sm mb-3">90-Day Forecast</h2>
      
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3a3a35" vertical={false} />
          <XAxis 
            dataKey="month" 
            stroke="#9ca3af" 
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickLine={false}
          />
          <YAxis 
            stroke="#9ca3af" 
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#2C2C2C', 
              border: '1px solid #3a3a35',
              borderRadius: '4px',
              fontSize: '11px',
            }}
          />
          <Bar dataKey="actual" fill="#faff6a" name="Actual" />
          <Bar dataKey="forecast" fill="#3b82f6" name="Forecast" opacity={0.7} />
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="bg-[#1f1f1c] rounded p-2">
          <div className="text-[#9ca3af] text-[10px] mb-1">Avg Forecast</div>
          <div className="text-white text-sm">78.5%</div>
        </div>
        <div className="bg-[#1f1f1c] rounded p-2">
          <div className="text-[#9ca3af] text-[10px] mb-1">Peak Month</div>
          <div className="text-white text-sm">June</div>
        </div>
      </div>
    </div>
  );
}
