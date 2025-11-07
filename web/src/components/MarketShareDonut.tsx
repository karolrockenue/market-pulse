import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export function MarketShareDonut() {
  const data = [
    { name: 'Luxury', value: 28, color: '#faff6a' },
    { name: 'Upper Midscale', value: 22, color: '#3b82f6' },
    { name: 'Midscale', value: 25, color: '#10b981' },
    { name: 'Economy', value: 18, color: '#f59e0b' },
    { name: 'Hostel', value: 7, color: '#9ca3af' },
  ];

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-4">
      <h2 className="text-[#e5e5e5] text-sm mb-3">Market Share by Tier</h2>
      
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="50%" height={140}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={55}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#2C2C2C', 
                border: '1px solid #3a3a35',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        <div className="flex-1 space-y-1">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[#e5e5e5] text-xs">{item.name}</span>
              </div>
              <span className="text-[#9ca3af] text-xs">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
