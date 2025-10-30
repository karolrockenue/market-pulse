interface Competitor {
  name: string;
  occupancy: number;
  adr: number;
  revpar: number;
}

interface CompetitorCardProps {
  competitors: Competitor[];
}

export function CompetitorCard({ competitors }: CompetitorCardProps) {
  return (
    <div className="bg-[#262626] rounded border border-[#3a3a35] p-3">
      <h3 className="text-[#e5e5e5] mb-3 text-sm">Top Competitors</h3>
      <div className="space-y-2">
        {competitors.map((comp, index) => (
          <div key={index} className="bg-[#1f1f1c] rounded p-2">
            <div className="text-[#e5e5e5] text-xs mb-1.5">{comp.name}</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-[#9ca3af]">Occ</div>
                <div className="text-[#e5e5e5]">{comp.occupancy.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[#9ca3af]">ADR</div>
                <div className="text-[#e5e5e5]">${comp.adr.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-[#9ca3af]">RevPAR</div>
                <div className="text-[#e5e5e5]">${comp.revpar.toFixed(0)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
