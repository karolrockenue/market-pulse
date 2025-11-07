import { FileText, TrendingUp, TrendingDown, Users, RefreshCw, Lock, LayoutDashboard, ChevronRight, Activity, DollarSign, Building2, DoorOpen, Calendar, Sparkles, AlertTriangle } from 'lucide-react';

interface RockenueHubProps {
  onNavigateToTool: (toolId: string) => void;
  // [NEW] Add userInfo to check the user's role
  userInfo: { role: string } | null;
}

// [NEW] Inline styles to replace broken Tailwind classes
const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#1d1d1c',
  },
  heroBanner: {
    borderBottom: '1px solid #3a3a35',
  },
  container: {
    maxWidth: '80rem', // 1280px, max-w-7xl
    margin: '0 auto',
    padding: '32px', // px-8, py-8
  },
  containerTools: {
    maxWidth: '80rem', // 1280px, max-w-7xl
    margin: '0 auto',
    padding: '32px', // px-8, py-8
  },
  flexBetween: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  flexGap3: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  heroIconWrapper: {
    position: 'relative' as 'relative',
  },
  heroIconBlur: {
    position: 'absolute' as 'absolute',
    inset: '0',
    backgroundColor: '#faff6a',
    filter: 'blur(16px)',
    opacity: 0.3,
  },
  heroIcon: {
    position: 'relative' as 'relative',
    width: '48px', // w-12
    height: '48px', // h-12
    borderRadius: '0.75rem', // rounded-xl
    background: 'linear-gradient(to bottom right, #faff6a, #e8eb5a)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: '1.875rem', // text-3xl
  },
  heroSubtitle: {
    color: '#9ca3af',
    fontSize: '0.875rem', // text-sm
  },
  activeBadge: {
    padding: '8px 16px',
    borderRadius: '0.5rem',
    backgroundColor: '#2C2C2C',
    border: '1px solid #3a3a35',
  },
  activeIndicator: {
    width: '6px', // w-1.5
    height: '6px', // h-1.5
    borderRadius: '9999px',
    backgroundColor: '#4ade80', // green-400
  },
  activeText: {
    color: '#9ca3af',
    fontSize: '0.875rem', // text-sm
  },
  section: {
    marginBottom: '32px', // mb-8
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px', // mb-4
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: '0.75rem', // text-xs
    textTransform: 'uppercase' as 'uppercase',
    letterSpacing: '0.05em', // tracking-wider
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px', // gap-4
  },
  toolCard: {
    textAlign: 'left' as 'left',
    padding: '20px', // p-5
    borderRadius: '0.5rem', // rounded-lg
    backgroundColor: '#2C2C2C',
    border: '1px solid #3a3a35',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  toolCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '16px', // mb-4
  },
  toolIconWrapper: {
    width: '44px', // w-11
    height: '44px', // h-11
    borderRadius: '0.5rem', // rounded-lg
    backgroundColor: 'rgba(250, 255, 106, 0.1)', // bg-[#faff6a]/10
    border: '1px solid rgba(250, 255, 106, 0.3)', // border-[#faff6a]/30
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  toolCardTitle: {
    color: '#ffffff',
    marginBottom: '8px', // mb-2
    fontSize: '1rem', // text-base
  },
  toolCardDescription: {
    color: '#9ca3af',
    fontSize: '0.875rem', // text-sm
    lineHeight: '1.4', // leading-snug
    marginBottom: '12px', // mb-3
  },
  toolCardFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingTop: '12px', // pt-3
    borderTop: '1px solid #3a3a35',
  },
  toolCardFooterText: {
    color: '#6b6b68',
    fontSize: '0.75rem', // text-xs
  },
  disabledIndicator: {
    width: '6px', // w-1.5
    height: '6px', // h-1.5
    borderRadius: '9999px',
    backgroundColor: '#6b6b68',
  },
  disabledSectionTitle: {
    color: '#6b6b68',
    fontSize: '0.75rem', // text-xs
    textTransform: 'uppercase' as 'uppercase',
    letterSpacing: '0.05em', // tracking-wider
  },
  toolCardDisabled: {
    textAlign: 'left' as 'left',
    padding: '20px', // p-5
    borderRadius: '0.5rem', // rounded-lg
    backgroundColor: '#1f1f1c',
    border: '1px solid #2a2a27',
    opacity: 0.6,
  },
  toolIconWrapperDisabled: {
    width: '44px', // w-11
    height: '44px', // h-11
    borderRadius: '0.5rem', // rounded-lg
    backgroundColor: '#2a2a27',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px', // gap-1.5
    padding: '4px 8px', // px-2 py-1
    borderRadius: '9999px', // rounded-full
    backgroundColor: '#2a2a27',
  },
  soonText: {
    fontSize: '9px',
    textTransform: 'uppercase' as 'uppercase',
    letterSpacing: '0.05em', // tracking-wider
    color: '#6B6B68',
  },
  toolCardTitleDisabled: {
    color: '#6b6b68',
    marginBottom: '8px', // mb-2
  },
  toolCardDescriptionDisabled: {
    color: '#6b6b68',
    fontSize: '0.875rem', // text-sm
    lineHeight: '1.4', // leading-snug
  },
};


export function RockenueHub({ onNavigateToTool, userInfo }: RockenueHubProps) {
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
      icon: AlertTriangle, // [MODIFIED] Changed to AlertTriangle for clarity
      active: true,
      status: 'operational',
      lastUpdated: '5 min ago',
    },
    {
      id: 'shreeji-report',
      title: 'Shreeji Report',
      description: 'In-house guest list with outstanding balances',
      icon: DollarSign, // [MODIFIED] Changed to DollarSign
      active: true,
      status: 'operational',
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
    <div style={styles.page}>
      {/* Hero Section */}
      <div style={styles.heroBanner}>
        <div style={styles.container}>
          <div style={styles.flexBetween}>
            <div>
              <div style={{...styles.flexGap3, marginBottom: '12px'}}>
                <div style={styles.heroIconWrapper}>
                  <div style={styles.heroIconBlur}></div>
                  <div style={styles.heroIcon}>
                    <Sparkles style={{width: '24px', height: '24px', color: '#1d1d1c'}} />
                  </div>
                </div>
                <div>
                  <h1 style={styles.heroTitle}>Rockenue Hub</h1>
                  <p style={styles.heroSubtitle}>Portfolio Intelligence Center</p>
                </div>
              </div>
            </div>
            <div style={styles.flexGap3}>
              <div style={styles.activeBadge}>
                <div style={styles.flexGap3}>
                  <div style={styles.activeIndicator}></div>
                  <span style={styles.activeText}>{activeCount} Tools Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Section */}
      <div style={styles.containerTools}>
        {/* Active Tools */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.activeIndicator}></div>
            <span style={styles.sectionTitle}>Active</span>
          </div>
          <div style={styles.grid}>
   {tools.filter(t => t.active).map((tool) => {
          // [MODIFIED] Get the Icon component directly from the array
          const Icon = tool.icon;

          // [NEW] Check if this tool should be disabled for 'admin' role
          const isPortfolioOverview = tool.id === 'portfolio-overview';
          const isAdmin = userInfo?.role === 'admin';

          if (isPortfolioOverview && isAdmin) {
            // Render a disabled card for 'admin' users
            return (
              <div
                key={tool.id}
                style={styles.toolCardDisabled}
              >
                <div style={styles.toolCardHeader}>
                  <div style={styles.toolIconWrapperDisabled}>
                    <Icon style={{ width: '20px', height: '20px', color: '#6b6b68' }} />
                  </div>
                  <div style={styles.soonBadge}>
                    {/* Use the Lock icon from lucide-react */}
                    <Lock style={{ width: "12px", height: "12px", stroke: "#6b6b68" }} />
                    <span style={styles.soonText}>Restricted</span>
                  </div>
                </div>
                <h3 style={styles.toolCardTitleDisabled}>
                  {tool.title}
                </h3>
                <p style={styles.toolCardDescriptionDisabled}>
                  {tool.description}
                </p>
                <div style={styles.toolCardFooter}>
                  <Activity style={{ width: '12px', height: '12px', color: '#6b6b68' }} />
                  <span style={styles.toolCardFooterText}>Access denied</span>
                </div>
              </div>
            );
          }

          // Render the normal, clickable card for everyone else
          return (
            <button
              key={tool.id}
              onClick={() => onNavigateToTool(tool.id)}
              style={styles.toolCard}
            >
                  <div style={styles.toolCardHeader}>
                    <div style={styles.toolIconWrapper}>
                      
                      {/* === [FIX] ===
                        Render the Icon component dynamically.
                        This uses the updated icons (AlertTriangle, DollarSign)
                        and the correct active color.
                      */}
                      <Icon style={{ width: '20px', height: '20px', color: '#faff6a' }} />
                      
                    </div>
                    <ChevronRight style={{ width: '16px', height: '16px', color: '#6b6b68' }} />
                  </div>
                  
                  <h3 style={styles.toolCardTitle}>
                    {tool.title}
                  </h3>
                  
                  <p style={styles.toolCardDescription}>
                    {tool.description}
                  </p>

                  <div style={styles.toolCardFooter}>
                    <Activity style={{ width: '12px', height: '12px', color: '#6b6b68' }} />
                    <span style={styles.toolCardFooterText}>Updated {tool.lastUpdated}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Coming Soon Tools */}
        <div>
          <div style={styles.sectionHeader}>
            <div style={styles.disabledIndicator}></div>
            <span style={styles.disabledSectionTitle}>Coming Soon</span>
          </div>
          <div style={styles.grid}>
            {tools.filter(t => !t.active).map((tool) => {
              const Icon = tool.icon;
              
              return (
                <div
                  key={tool.id}
                  style={styles.toolCardDisabled}
                >
                  <div style={styles.toolCardHeader}>
                    <div style={styles.toolIconWrapperDisabled}>
                      {/* Using the Icon component with an inline style for size/color */}
                      <Icon style={{ width: '20px', height: '20px', color: '#6b6b68' }} />
                    </div>
                    <div style={styles.soonBadge}>
                      
                      {/* === [FIX] ===
                        Using the inline SVG from our previous fix.
                      */}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", width: "12px", height: "12px", stroke: "#6b6b68", fill: "none" }}>
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      
                      <span style={styles.soonText}>Soon</span>
                    </div>
                  </div>
                  
                  <h3 style={styles.toolCardTitleDisabled}>
                    {tool.title}
                  </h3>
                  
                  <p style={styles.toolCardDescriptionDisabled}>
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