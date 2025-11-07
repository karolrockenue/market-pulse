interface TableRow {
  date: string;
  yourOccupancy: number;
  yourADR: number;
  yourRevPAR: number;
  marketOccupancy: number;
  marketADR: number;
  marketRevPAR: number;
}

interface DataTableProps {
  data: TableRow[];
  comparisonMetric: string;
  currencyCode: string; // [NEW] Accept the currency code
}

export function DataTable({ data, comparisonMetric, currencyCode }: DataTableProps) {
  const calculateDelta = (row: TableRow) => {
    switch (comparisonMetric) {
      case 'occupancy':
        return row.yourOccupancy - row.marketOccupancy;
      case 'adr':
        return row.yourADR - row.marketADR;
      case 'revpar':
        return row.yourRevPAR - row.marketRevPAR;
      default:
        return 0;
    }
  };

  // [NEW] Create a currency formatter function
  const formatCurrency = (value: number) => {
    if (isNaN(value)) value = 0; // Handle potential NaN values
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode, // Use the dynamic prop
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    // The main container now also serves as the scrollable area.
    <div
      className="bg-[#2C2C2C] rounded border border-[#3a3a35] overflow-y-auto"
      style={{ maxHeight: '500px' }}
    >
      {/* A single table is used for both the header and body. 
          'table-layout-fixed' is crucial for performance and consistent column widths. */}
      <table className="w-full" style={{ tableLayout: 'fixed' }}>
        {/* The 'thead' is now sticky. It will stay at the top of the scrolling container. */}
        <thead className="sticky top-0 bg-[#2C2C2C] z-10">
          <tr className="border-b border-[#3a3a35]">
            <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Date</th>
            <th colSpan={3} className="px-6 py-3 text-center text-[#e5e5e5] text-xs uppercase tracking-wider border-l border-[#3a3a35]">
              Your Hotel
            </th>
            <th colSpan={3} className="px-6 py-3 text-center text-[#e5e5e5] text-xs uppercase tracking-wider border-l border-[#3a3a35]">
              The Market
            </th>
            <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider border-l border-[#3a3a35]">Delta</th>
          </tr>
          <tr className="border-b border-[#3a3a35] bg-[#3a3a35]/30">
            <th className="px-6 py-2"></th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-[#9ca3af]">Occupancy</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-[#9ca3af]">ADR</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-[#9ca3af] border-r border-[#3a3a35]">RevPAR</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-[#9ca3af]">Occupancy</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-[#9ca3af]">ADR</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-[#9ca3af] border-r border-[#3a3a35]">RevPAR</th>
            <th className="px-6 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            const delta = calculateDelta(row);
            
            // [NEW] Determine delta formatting
            const isCurrency = comparisonMetric === 'adr' || comparisonMetric === 'revpar';
            const deltaColor = delta > 0 ? 'text-[#10b981]' : delta < 0 ? 'text-[#ef4444]' : 'text-[#9ca3af]';
            let formattedDelta: string;

            if (isCurrency) {
              // [NEW] Format currency delta (e.g., +$10.50)
              formattedDelta = `${delta > 0 ? '+' : ''}${formatCurrency(delta)}`;
            } else {
              // [NEW] Format occupancy delta (e.g., -5.1%)
              formattedDelta = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
            }

            return (
              <tr key={index} className="border-t border-[#3a3a35] hover:bg-[#3a3a35]/30 transition-colors">
                <td className="px-6 py-3 text-[#e5e5e5] text-xs">{row.date}</td>
                <td className="px-4 py-3 text-xs text-[#e5e5e5]">{row.yourOccupancy.toFixed(1)}%</td>
                {/* [MODIFIED] Use the formatter */}
                <td className="px-4 py-3 text-xs text-[#e5e5e5]">{formatCurrency(row.yourADR)}</td>
                {/* [MODIFIED] Use the formatter */}
                <td className="px-4 py-3 text-xs text-[#e5e5e5] border-r border-[#3a3a35]">{formatCurrency(row.yourRevPAR)}</td>
                <td className="px-4 py-3 text-xs text-[#9ca3af]">{row.marketOccupancy.toFixed(1)}%</td>
                {/* [MODIFIED] Use the formatter */}
                <td className="px-4 py-3 text-xs text-[#9ca3af]">{formatCurrency(row.marketADR)}</td>
                {/* [MODIFIED] Use the formatter */}
                <td className="px-4 py-3 text-xs text-[#9ca3af] border-r border-[#3a3a35]">{formatCurrency(row.marketRevPAR)}</td>
                {/* [MODDIFIED] Use the new formattedDelta variable */}
                <td className={`px-6 py-3 text-xs ${deltaColor}`}>
                  {formattedDelta}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}