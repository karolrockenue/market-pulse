import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from './ui/button';
import { useState } from 'react';

export function HistoricalTrendsChart() {
  const [metric, setMetric] = useState<'revpar' | 'adr' | 'occupancy'>('revpar');
  const [selectedTiers, setSelectedTiers] = useState(['entire', 'luxury']);

  const tiers = [
    { id: 'entire', label: 'Market', color: '#faff6a' },
    { id: 'luxury', label: 'Luxury', color: '#3b82f6' },
    { id: 'midscale', label: 'Midscale', color: '#10b981' },
    { id: 'economy', label: 'Economy', color: '#f59e0b' },
  ];

  // Generate mock data
  const data = Array.from({ length: 12 }, (_, i) => {
    const month = new Date(2025, i, 1).toLocaleDateString('en-US', { month: 'short' });
    const dataPoint: any = { month };
    
    if (selectedTiers.includes('entire')) dataPoint['entire'] = 150 + Math.random() * 50;
    if (selectedTiers.includes('luxury')) dataPoint['luxury'] = 200 + Math.random() * 80;
    if (selectedTiers.includes('midscale')) dataPoint['midscale'] = 100 + Math.random() * 30;
    if (selectedTiers.includes('economy')) dataPoint['economy'] = 60 + Math.random() * 20;
    
    return dataPoint;
  });

  const toggleTier = (tierId: string) => {
    setSelectedTiers(prev =>
      prev.includes(tierId)
        ? prev.filter(id => id !== tierId)
        : [...prev, tierId]
    );
  };

  return (
    <div className="bg-[#262626] rounded border border-[#3a3a35] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[#e5e5e5] text-sm">Historical Trends</h2>
        <div className="flex gap-1">
          {(['revpar', 'adr', 'occupancy'] as const).map((m) => (
            <Button
              key={m}
              onClick={() => setMetric(m)}
              className={`h-6 px-2 text-xs ${
                metric === m
                  ? 'bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]'
                  : 'bg-[#1f1f1c] text-[#9ca3af] hover:bg-[#3a3a35] border border-[#3a3a35]'
              }`}
            >
              {m.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mb-3 flex-wrap">
        {tiers.map((tier) => (
          <button
            key={tier.id}
            onClick={() => toggleTier(tier.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              selectedTiers.includes(tier.id)
                ? 'bg-[#3a3a35] text-[#e5e5e5]'
                : 'text-[#9ca3af] hover:text-[#e5e5e5]'
            }`}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
            {tier.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
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
              backgroundColor: '#262626', 
              border: '1px solid #3a3a35',
              borderRadius: '4px',
              fontSize: '11px',
            }}
          />
          {selectedTiers.map(tierId => {
            const tier = tiers.find(t => t.id === tierId);
            return tier ? (
              <Line
                key={tierId}
                type="monotone"
                dataKey={tierId}
                stroke={tier.color}
                strokeWidth={2}
                dot={false}
              />
            ) : null;
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
