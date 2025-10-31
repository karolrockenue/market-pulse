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
      icon: LayoutDashboard,
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
      {/* Hero Section */}
      <div className="border-b border-[#3a3a35]">
        <div className="max-w-7xl mx-auto px-8 py-8">
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
              const Icon = tool.icon;
              
              return (
                <button
                  key={tool.id}
                  onClick={() => onNavigateToTool(tool.id)}
                  className="group text-left p-5 rounded-lg bg-[#262626] border border-[#3a3a35] hover:border-[#faff6a] hover:bg-[#2d2d28] transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-lg bg-[#faff6a]/10 border border-[#faff6a]/30 flex items-center justify-center group-hover:bg-[#faff6a]/20 transition-all">
                      {/* [FIX] Removed fill="currentColor" */}
                      <Icon className="w-5 h-5 text-[#faff6a]" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#6b6b68] group-hover:text-[#faff6a] transition-colors" />
                  </div>
                  
                  <h3 className="text-white mb-2">
                    {tool.title}
                  </h3>
                  
                  <p className="text-[#9ca3af] text-sm leading-snug mb-3">
                    {tool.description}
                  </p>
                  {/* [FIX] The invalid text has been removed and the tag is correctly closed. */}

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
              const Icon = tool.icon;
              
              return (
                <div
                  key={tool.id}
                  className="text-left p-5 rounded-lg bg-[#1f1f1c] border border-[#2a2a27] opacity-60"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-lg bg-[#2a2a27] flex items-center justify-center">
                      {/* [FIX] Removed fill="currentColor" */}
                      <Icon className="w-5 h-5 text-[#6b6b68]" />
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#2a2a27]">
                      {/* [FIX] Removed fill="currentColor" */}
                      <Lock className="w-3 h-3 text-[#6b6b68]" />
                      <span className="text-[9px] uppercase tracking-wider text-[#6b6b68]">Soon</span>
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