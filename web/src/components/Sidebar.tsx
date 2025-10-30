import { BarChart3, LayoutDashboard, FileText, Settings, Shield } from 'lucide-react';

export function Sidebar() {
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, active: true },
    { label: 'Market Overview', icon: BarChart3, active: false },
    { label: 'Reports', icon: FileText, active: false },
    { label: 'Settings', icon: Settings, active: false },
    { label: 'Admin Panel', icon: Shield, active: false },
  ];

  return (
    <div className="w-64 bg-[#0d0d0e] border-r border-[#2a2a2d] h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-[#d4ff00]">Market Pulse</h1>
      </div>
      
      <nav className="flex-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-3 mb-1 rounded-lg transition-colors ${
                item.active
                  ? 'bg-[#1a1a1c] text-[#d4ff00]'
                  : 'text-[#9ca3af] hover:bg-[#1a1a1c] hover:text-[#e5e5e5]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
