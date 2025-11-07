import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function PricingDistribution() {
  const data = [
    { range: '$0-50', properties: 12 },
    { range: '$50-100', properties: 28 },
    { range: '$100-150', properties: 42 },
    { range: '$150-200', properties: 38 },
    { range: '$200-250', properties: 32 },
    { range: '$250+', properties: 23 },
  ];

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-4">
      <h2 className="text-[#e5e5e5] text-sm mb-3">ADR Distribution</h2>
      
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3a3a35" vertical={false} />
          <XAxis 
            dataKey="range" 
            stroke="#9ca3af" 
            tick={{ fill: '#9ca3af', fontSize: 9 }}
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
          <Bar dataKey="properties" fill="#faff6a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
