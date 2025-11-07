import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';

interface Area {
  name: string;
  revpar: number;
  adr: number;
  occupancy: number;
  yoyChange: number;
  hotelCount: number;
}

export function AreaPerformanceTable() {
  const [selectedMetric, setSelectedMetric] = useState<'revpar' | 'adr' | 'occupancy'>('revpar');

  const areas: Area[] = [
    { name: 'Downtown', revpar: 185, adr: 245, occupancy: 75.5, yoyChange: 12.3, hotelCount: 42 },
    { name: 'Waterfront', revpar: 165, adr: 220, occupancy: 75.0, yoyChange: 8.5, hotelCount: 28 },
    { name: 'Airport', revpar: 95, adr: 135, occupancy: 70.4, yoyChange: -2.1, hotelCount: 18 },
    { name: 'Old Town', revpar: 145, adr: 195, occupancy: 74.4, yoyChange: 15.2, hotelCount: 35 },
    { name: 'Business', revpar: 175, adr: 235, occupancy: 74.5, yoyChange: 6.8, hotelCount: 52 },
  ];

  const getHeatmapColor = (value: number, metric: string) => {
    let intensity = 0;
    if (metric === 'revpar') {
      intensity = Math.min(1, value / 200);
    } else if (metric === 'adr') {
      intensity = Math.min(1, value / 250);
    } else {
      intensity = value / 100;
    }
    
    const alpha = 0.1 + (intensity * 0.3);
    return `rgba(250, 255, 106, ${alpha})`;
  };

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#3a3a35] flex items-center justify-between">
        <h2 className="text-[#e5e5e5] text-sm">Area Performance</h2>
        <div className="flex gap-1">
          {(['revpar', 'adr', 'occupancy'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMetric(m)}
              className={`px-2 py-1 rounded text-[10px] transition-colors ${
                selectedMetric === m
                  ? 'bg-[#faff6a] text-[#1f1f1c]'
                  : 'bg-[#1f1f1c] text-[#9ca3af] hover:bg-[#3a3a35]'
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#3a3a35] bg-[#1f1f1c]">
              <th className="px-4 py-2 text-left text-[#9ca3af] text-[10px] uppercase tracking-wider">
                Area
              </th>
              <th className="px-4 py-2 text-right text-[#9ca3af] text-[10px] uppercase tracking-wider">
                RevPAR
              </th>
              <th className="px-4 py-2 text-right text-[#9ca3af] text-[10px] uppercase tracking-wider">
                ADR
              </th>
              <th className="px-4 py-2 text-right text-[#9ca3af] text-[10px] uppercase tracking-wider">
                Occ
              </th>
              <th className="px-4 py-2 text-right text-[#9ca3af] text-[10px] uppercase tracking-wider">
                YoY
              </th>
              <th className="px-4 py-2 text-right text-[#9ca3af] text-[10px] uppercase tracking-wider">
                Hotels
              </th>
            </tr>
          </thead>
          <tbody>
            {areas.map((area, index) => (
              <tr key={index} className="border-b border-[#3a3a35] hover:bg-[#3a3a35]/30 transition-colors">
                <td className="px-4 py-2 text-[#e5e5e5] text-xs">{area.name}</td>
                <td 
                  className="px-4 py-2 text-white text-xs text-right"
                  style={{ backgroundColor: selectedMetric === 'revpar' ? getHeatmapColor(area.revpar, 'revpar') : undefined }}
                >
                  ${area.revpar}
                </td>
                <td 
                  className="px-4 py-2 text-white text-xs text-right"
                  style={{ backgroundColor: selectedMetric === 'adr' ? getHeatmapColor(area.adr, 'adr') : undefined }}
                >
                  ${area.adr}
                </td>
                <td 
                  className="px-4 py-2 text-white text-xs text-right"
                  style={{ backgroundColor: selectedMetric === 'occupancy' ? getHeatmapColor(area.occupancy, 'occupancy') : undefined }}
                >
                  {area.occupancy}%
                </td>
                <td className={`px-4 py-2 text-xs text-right ${
                  area.yoyChange > 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                }`}>
                  {area.yoyChange > 0 ? '+' : ''}{area.yoyChange}%
                </td>
                <td className="px-4 py-2 text-[#9ca3af] text-xs text-right">{area.hotelCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
