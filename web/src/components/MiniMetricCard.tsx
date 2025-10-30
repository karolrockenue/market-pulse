interface MiniMetricCardProps {
  label: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
  comingSoon?: boolean; // [NEW] Add the comingSoon prop
}

export function MiniMetricCard({ label, value, subtext, highlight, comingSoon }: MiniMetricCardProps) {
  return (
    // [MODIFIED] Add opacity if comingSoon is true
    <div className={`bg-[#262626] rounded border border-[#3a3a35] p-3 ${comingSoon ? 'opacity-90' : ''}`}>
      {/* [MODIFIED] Add flex wrapper to hold label and badge */}
      <div className="flex items-center gap-1.5 mb-1">
        <div className="text-[#9ca3af] text-xs">{label}</div>

        {/* [NEW] Add the Coming Soon badge */}
        {comingSoon && (
          <div 
            className="text-[#6b7280] px-1.5 py-0.5 bg-[#1f1f1c] rounded border border-[#3a3a35]"
            style={{ fontSize: '9px' }} // [FIX] Use inline style instead of arbitrary text-[9px] class
          >
            Coming Soon
          </div>
        )}
      </div>
      <div className={`text-xl ${highlight ? 'text-[#faff6a]' : 'text-white'}`}>{value}</div>
      {subtext && <div className={`text-[#9ca3af] text-xs mt-1`}>{subtext}</div>}
    </div>
  );
}