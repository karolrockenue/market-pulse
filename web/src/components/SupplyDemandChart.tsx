import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function SupplyDemandChart() {
  const data = [
    { month: 'Jan', demand: 5200, supply: 6100, occupancy: 72 },
    { month: 'Feb', demand: 4800, supply: 6100, occupancy: 68 },
    { month: 'Mar', demand: 5500, supply: 6100, occupancy: 75 },
    { month: 'Apr', demand: 5800, supply: 6200, occupancy: 78 },
    { month: 'May', demand: 6200, supply: 6200, occupancy: 82 },
    { month: 'Jun', demand: 6400, supply: 6300, occupancy: 85 },
  ];

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-4">
      <h2 className="text-[#e5e5e5] text-sm mb-3">Supply & Demand Balance</h2>
      
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data}>
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
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <Bar dataKey="demand" fill="#faff6a" name="Demand" />
          <Bar dataKey="supply" fill="#3a3a35" name="Supply" />
          <Line type="monotone" dataKey="occupancy" stroke="#10b981" strokeWidth={2} name="Occ %" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
