import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  RefreshCw, 
  Lock, 
  LayoutDashboard, 
  ChevronRight, 
  Activity, 
  Sparkles 
} from 'lucide-react';

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
    // [FIX] Using semantic 'bg-background' and moved padding to the top level.
    <div className="min-h-screen bg-background p-8">
      {/* Hero Section */}
      {/* [FIX] Using 'border-border' and removed redundant padding. */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between pb-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  {/* [FIX] Use 'bg-primary' for blur */}
                  <div className="absolute inset-0 bg-primary blur-lg opacity-30"></div>
                  {/* [FIX] Use 'bg-primary' and 'text-primary-foreground' */}
                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/90 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  {/* [FIX] Use 'text-foreground' and 'text-muted-foreground' */}
                  <h1 className="text-foreground text-3xl">Rockenue Hub</h1>
                  <p className="text-muted-foreground text-sm">Portfolio Intelligence Center</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* [FIX] Use 'bg-card', 'border-border', and 'text-muted-foreground' */}
              <div className="px-4 py-2 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <span className="text-muted-foreground text-sm">{activeCount} Tools Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Section */}
      <div className="max-w-7xl mx-auto py-8">
        {/* Active Tools */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            {/* [FIX] Use 'text-muted-foreground' */}
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Active</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {tools.filter(t => t.active).map((tool) => {
              const Icon = tool.icon;
              
              return (
                <button
                  key={tool.id}
                  // [FIX] Use 'bg-card', 'border-border', 'hover:border-primary', and 'hover:bg-secondary'
                  onClick={() => onNavigateToTool(tool.id)}
                  className="group text-left p-5 rounded-lg bg-card border border-border hover:border-primary hover:bg-secondary transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    {/* [FIX] Replaced inline style with semantic Tailwind classes */}
                    <div 
                      className="w-11 h-11 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/30 group-hover:bg-primary/20 transition-all"
                    >
                      {/* [FIX] Use 'text-primary' */}
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    {/* [FIX] Use 'text-muted-foreground' and 'group-hover:text-primary' */}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  
                  {/* [FIX] Use 'text-foreground' */}
                  <h3 className="text-foreground mb-2">
                    {tool.title}
                  </h3>
                  
                  {/* [FIX] Use 'text-muted-foreground' */}
                  <p className="text-muted-foreground text-sm leading-snug mb-3">
                    {tool.description}
                  </p>

                  {/* [FIX] Use 'border-border' and 'text-muted-foreground' */}
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <Activity className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground text-xs">Updated {tool.lastUpdated}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Coming Soon Tools */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            {/* [FIX] Use 'bg-muted-foreground' */}
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground"></div>
            {/* [FIX] Use 'text-muted-foreground' */}
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Coming Soon</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {tools.filter(t => !t.active).map((tool) => {
              const Icon = tool.icon;
              
              return (
                <div
                  key={tool.id}
                  // [FIX] Use 'bg-card' and 'border-border' for consistency
                  className="text-left p-5 rounded-lg bg-card border border-border opacity-60"
                >
                  <div className="flex items-start justify-between mb-4">
                    {/* [FIX] Use 'bg-secondary' and 'text-muted-foreground' */}
                    <div className="w-11 h-11 rounded-lg bg-secondary flex items-center justify-center">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    {/* [FIX] Use 'bg-secondary' and 'text-muted-foreground' */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary">
                      <Lock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Soon</span>
                    </div>
                  </div>
                  
                  {/* [FIX] Use 'text-muted-foreground' */}
                  <h3 className="text-muted-foreground mb-2">
                    {tool.title}
                  </h3>
                  
                  {/* [FIX] Use 'text-muted-foreground' */}
                  <p className="text-muted-foreground text-sm leading-snug">
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