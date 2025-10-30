import { BarChart3, Globe, DollarSign, Users, TrendingUp, Calendar, ArrowUpDown } from 'lucide-react';
import { Button } from './ui/button';

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: any;
  category: string;
  available: boolean;
}

interface ReportSelectorProps {
  onSelectReport: (reportId: string) => void;
}

export function ReportSelector({ onSelectReport }: ReportSelectorProps) {
  const reportTypes: ReportType[] = [
{
      id: 'performance-metrics',
      title: 'Performance Metrics',
      description: 'Comprehensive analysis of occupancy, ADR, RevPAR, and market comparisons over time',
      icon: BarChart3,
      category: 'Core Analytics',
      available: true,
    },
    // [NEW] Add the Year-on-Year report from the prototype
    {
      id: 'year-on-year',
      title: 'Year-on-Year Comparison',
      description: 'Side-by-side comparison of 2024 vs 2025 performance with variance analysis and growth metrics',
      icon: ArrowUpDown,
      category: 'Core Analytics',
      available: true,
    },
{
      id: 'guest-source-countries',
      title: 'Guest Source Countries',
      description: 'Geographic breakdown of guest origins, booking patterns, and regional market insights',
      icon: Globe,
      category: 'Guest Analytics',
      available: false, // [MODIFIED] Set to false to disable
    },
    {
      id: 'financial-transactions',
      title: 'Financial Transactions',
      description: 'Detailed financial reporting including revenue streams, payment methods, and transaction analysis',
      icon: DollarSign,
      category: 'Financial',
      available: false, // [MODIFIED] Set to false to disable
    },
    {
      id: 'guest-demographics',
      title: 'Guest Demographics',
      description: 'Analyze guest profiles, booking behavior, length of stay, and customer segmentation',
      icon: Users,
      category: 'Guest Analytics',
      available: false,
    },
    {
      id: 'forecast-report',
      title: 'Forecast & Projections',
      description: 'Forward-looking analysis with demand forecasting, rate recommendations, and revenue projections',
      icon: TrendingUp,
      category: 'Forecasting',
      available: false,
    },
    {
      id: 'events-impact',
      title: 'Events Impact Analysis',
      description: 'Correlation between local events, market demand, and pricing performance',
      icon: Calendar,
      category: 'Market Intelligence',
      available: false,
    },
  ];

// src/components/ReportSelector.tsx
  return (
    <div>
    {/* [FIX] Removed max-w-7xl and mx-auto to align the header to the left */}
    <div className="mb-8"> 
        <h1 className="text-white text-2xl mb-2">Advanced Reporting</h1>
        <p className="text-[#9ca3af] text-sm">Select a report type to begin building your custom analysis</p>
      </div>

      {/* Report Categories */}
      <div className="space-y-6">
        {['Core Analytics', 'Guest Analytics', 'Financial', 'Forecasting', 'Market Intelligence'].map(category => {
          const categoryReports = reportTypes.filter(r => r.category === category);
          if (categoryReports.length === 0) return null;

          return (
            <div key={category}>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-[#3a3a35]" />
                <h2 className="text-[#9ca3af] text-xs uppercase tracking-wider">{category}</h2>
                <div className="h-px flex-1 bg-[#3a3a35]" />
              </div>
              
<div 
  className="grid gap-4"
  style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
>
                {categoryReports.map(report => {
                  const Icon = report.icon;
                  return (
             <div
                      key={report.id}
                      // [MODIFIED] Removed 'flex flex-col' from className
                      className={`bg-[#1a1a18] border rounded-lg p-6 transition-all ${
                        report.available
                          ? 'border-[#3a3a35] hover:border-[#faff6a] hover:shadow-lg hover:shadow-[#faff6a]/10 cursor-pointer'
                          : 'border-[#2a2a25] opacity-50'
                      }`}
                      // [FIX] Apply flex styles inline to force alignment.
                      style={{ display: 'flex', flexDirection: 'column' }}
                    >
                      {/* This is the top part of the card with the icon and badge */}
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          report.available ? 'bg-[#faff6a]/10' : 'bg-[#3a3a35]/30'
                        }`}>
                          <Icon className={`w-6 h-6 ${
                            report.available ? 'text-[#faff6a]' : 'text-[#6b7280]'
                          }`} />
                        </div>
                        {!report.available && (
                          <span className="text-[#6b7280] text-xs bg-[#2a2a25] px-2 py-1 rounded">
                            Coming Soon
                          </span>
                        )}
                      </div>

                      {/* [FIX] Apply flex-grow style inline. */}
                      <div style={{ flexGrow: 1 }}>
                        <h3 className="text-[#e5e5e5] mb-2">{report.title}</h3>
                        <p className="text-[#9ca3af] text-sm mb-4 line-clamp-2">
                          {report.description}
                        </p>
                      </div>

                      {/* [FIX] Apply margin-top: auto style inline. */}
                      <Button
                        onClick={() => onSelectReport(report.id)}
                        disabled={!report.available}
                        // [MODIFIED] Removed 'mt-auto' from className
                        className={`w-full ${
                          report.available
                            ? 'bg-[#262626] text-[#e5e5e5] hover:bg-[#faff6a] hover:text-[#1a1a18] border border-[#3a3a35] hover:border-[#faff6a]'
                            : 'bg-[#2a2a25] text-[#6b7280] cursor-not-allowed'
                        }`}
                        // [FIX] Added inline style
                        style={{ marginTop: 'auto' }}
                      >
                        {report.available ? 'Select Report' : 'Not Available'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}

    </div>
  );
}
