import { FileText, TrendingUp, TrendingDown, Users, RefreshCw, Lock, LayoutDashboard, ChevronRight, Activity, DollarSign, Building2, DoorOpen, Calendar, Sparkles } from 'lucide-react';

interface RockenueHubProps {
  onNavigateToTool: (toolId: string) => void;
}

export function RockenueHub({ onNavigateToTool }: RockenueHubProps) {
  const tools = [
    {
      id: 'portfolio-overview',
      title: 'Portfolio Overview',
      description: 'Comprehensive view of portfolio performance and insights',
      icon: LayoutDashboard, // We still use this to find the right tool
      active: true,
      status: 'operational',
      lastUpdated: '2 min ago',
    },
    {
      id: 'portfolio-risk',
      title: 'Risk Overview',
      description: 'Identify hotels with excess availability and low pickup',
      icon: TrendingDown,
      active: true,
      status: 'operational',
      lastUpdated: '5 min ago',
    },
    {
      id: 'shreeji-report',
      title: 'Shreeji Report',
      description: 'In-house guest list with outstanding balances',
      icon: FileText,
      active: true,
      status: 'operational',
      lastUpdated: '12 min ago',
    },
    // ... (rest of the tools array is fine)
    {
      id: 'pricing-analyzer',
      title: 'Pricing Analyzer',
      description: 'Analyze and optimize your pricing strategy',
      icon: TrendingUp,
      active: false,
      status: 'development',
      comingSoon: true,
    },
    {
      id: 'user-management',
      title: 'User Management',
      description: 'Manage team members and permissions',
      icon: Users,
      active: false,
      status: 'development',
      comingSoon: true,
    },
    {
      id: 'data-sync-tool',
      title: 'Data Sync Tool',
      description: 'Synchronize data across systems',
      icon: RefreshCw,
      active: false,
      status: 'development',
      comingSoon: true,
    },
  ];

  const activeCount = tools.filter(t => t.active).length;

  return (
    <div className="min-h-screen bg-[#1d1d1c]">
      {/* Hero Section (No changes) */}
      <div className="border-b border-[#3a3a35]">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* ... (all hero section code is correct) ... */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#faff6a] blur-lg opacity-30"></div>
                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-[#faff6a] to-[#e8eb5a] flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[#1d1d1c]" />
                  </div>
                </div>
                <div>
                  <h1 className="text-white text-3xl">Rockenue Hub</h1>
                  <p className="text-[#9ca3af] text-sm">Portfolio Intelligence Center</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-lg bg-[#262626] border border-[#3a3a35]">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]"></div>
                  <span className="text-[#9ca3af] text-sm">{activeCount} Tools Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Section */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Active Tools */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]"></div>
            <span className="text-[#9ca3af] text-xs uppercase tracking-wider">Active</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {tools.filter(t => t.active).map((tool) => {
              // const Icon = tool.icon; // We no longer need this
              
              return (
                <button
                  key={tool.id}
                  onClick={() => onNavigateToTool(tool.id)}
                  className="group text-left p-5 rounded-lg bg-[#262626] border border-[#3a3a35] hover:border-[#faff6a] hover:bg-[#2d2d28] transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-lg bg-[#faff6a]/10 border border-[#faff6a]/30 flex items-center justify-center group-hover:bg-[#faff6a]/20 transition-all">
                      
                      {/* === [FIX] ===
                        I am replacing the <Icon> component with inline SVGs to
                        force the correct styling and bypass all CSS conflicts.
                      */}
                      
                      {tool.id === 'portfolio-overview' && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ display: "inline-block", width: "20px", height: "20px", stroke: "#faff6a", fill: "none" }}>
                          <rect width="7" height="9" x="3" y="3" rx="1"></rect><rect width="7" height="5" x="14" y="3" rx="1"></rect><rect width="7" height="9" x="14" y="12" rx="1"></rect><rect width="7" height="5" x="3" y="16" rx="1"></rect>
                        </svg>
                      )}

                      {tool.id === 'portfolio-risk' && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ display: "inline-block", width: "20px", height: "20px", stroke: "#faff6a", fill: "none" }}>
                          <path d="M2.5 2.5h3l10 10l5-5v3l-3.5 3.5l-8-8L2.5 18.5v-3l5-5l-5-5z"></path><path d="m21.5 2.5 v3l-5.5 5.5l-2.5-2.5L21.5 2.5z"></path>
                        </svg>
                      )}

                      {tool.id === 'shreeji-report' && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ display: "inline-block", width: "20px", height: "20px", stroke: "#faff6a", fill: "none" }}>
                          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path>
                        </svg>
                      )}
                      
                    </div>
                    {/* The chevron icon is fine, no change needed */}
                    <ChevronRight className="w-4 h-4 text-[#6b6b68] group-hover:text-[#faff6a] transition-colors" />
                  </div>
                  
                  <h3 className="text-white mb-2">
                    {tool.title}
                  </h3>
                  
                  <p className="text-[#9ca3af] text-sm leading-snug mb-3">
                    {tool.description}
                  </p>

                  <div className="flex items-center gap-2 pt-3 border-t border-[#3a3a35]">
                    <Activity className="w-3 h-3 text-[#6b6b68]" />
                    <span className="text-[#6b6b68] text-xs">Updated {tool.lastUpdated}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Coming Soon Tools */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#6b6b68]"></div>
            <span className="text-[#6b6b68] text-xs uppercase tracking-wider">Coming Soon</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {tools.filter(t => !t.active).map((tool) => {
              const Icon = tool.icon; // This is fine for the disabled ones
              
              return (
                <div
                  key={tool.id}
                  className="text-left p-5 rounded-lg bg-[#1f1f1c] border border-[#2a2a27] opacity-60"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-lg bg-[#2a2a27] flex items-center justify-center">
                      {/* [FIX] Using size prop for these, but they should also be fixed */}
                      <Icon className="text-[#6b6b68]" size={20} />
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#2a2a27]">
                      
                      {/* === [FIX] ===
                        Replacing the <Lock> component with an inline SVG
                        to force the correct styling.
                      */}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ display: "inline-block", width: "12px", height: "12px", stroke: "#6b6b68", fill: "none" }}>
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      
                      <span className="text-[9px] uppercase tracking-wider text-[#6B6B68]">Soon</span>
                    </div>
                  </div>
                  
                  <h3 className="text-[#6b6b68] mb-2">
                    {tool.title}
                  </h3>
                  
                  <p className="text-[#6b6b68] text-sm leading-snug">
                    {tool.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}