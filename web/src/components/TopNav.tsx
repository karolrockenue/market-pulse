import {
  BarChart3,
  LayoutDashboard,
  FileText, 
  Settings,
  Shield, 
  RefreshCw,
  Sliders,
  LifeBuoy,
  LogOut,
  Zap, 
  ClipboardList, 
  ChevronDown, 
  Tag, 
  Home, 
  TerminalSquare, 
  DollarSign, 
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup, 
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { NotificationBell } from './NotificationBell'; // [NEW] Import the bell component

interface Property {
  property_id: number;
  property_name: string;
}
interface TopNavProps {
  activeView: string;
  onViewChange: (view: string) => void;
  property: string;
  onPropertyChange: (property: string) => void;
  properties: Property[];
  lastUpdatedAt: string | null;
  userInfo: { firstName: string; lastName: string; email: string; role: string; } | null;
}

export function TopNav({ activeView, onViewChange, property, onPropertyChange, properties, lastUpdatedAt, userInfo }: TopNavProps) {

  const getInitials = () => {
    if (userInfo) {
      const firstInitial = userInfo.firstName ? userInfo.firstName.charAt(0) : '';
      const lastInitial = userInfo.lastName ? userInfo.lastName.charAt(0) : '';
      return `${firstInitial}${lastInitial}`.toUpperCase();
    }
    return '...'; 
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      window.location.reload();
    }
  };

  const allNavItems = [
    { label: 'Dashboard', value: 'dashboard', icon: LayoutDashboard, isAdmin: false },
    { label: 'Reports', value: 'reports', icon: FileText, isAdmin: false },
    { label: 'Budget', value: 'budget', icon: ClipboardList, isAdmin: false },
    { label: 'Demand & Pace', value: 'demand-pace', icon: BarChart3, isAdmin: false },
    { label: 'Rockenue', value: 'rockenue', icon: Zap, isAdmin: true },
    { label: 'Admin', value: 'admin', icon: Zap, isAdmin: true },
    {
      label: 'Sentinel',
      value: 'sentinel-group',
      icon: Zap,
      isDropdown: true,
      isAdmin: true, 
      items: [
        { label: 'Control Panel', value: 'sentinel', icon: TerminalSquare },
        { label: 'Rate Manager', value: 'rateManager', icon: DollarSign },
        { label: 'Property Hub', value: 'propertyHub', icon: Home },
        { label: 'Shadowfax', value: 'shadowfax', icon: Tag },
      ],
    },
  ];

  const navItems = allNavItems.filter(item => {
    if ((item as any).isSuperAdminOnly) {
      return userInfo?.role === 'super_admin';
    }
    if (item.isAdmin) {
      return userInfo?.role === 'super_admin' || userInfo?.role === 'admin';
    }
    return true;
  });

  const showPropertySelector = activeView !== 'landing';

  return (
    <div className="bg-[#1f1f1c] border-b border-[#3a3a35] px-6 py-4 flex items-center justify-between shadow-lg relative z-50">
      <div className="flex items-center gap-10">
  
        <div className="flex items-center gap-1">
          <span className="text-[#faff6a] text-2xl">(</span>
          <span 
            className="text-[#e5e5e5] text-sm tracking-wide"
            style={{ position: 'relative', top: '2px' }} 
          >
            MARKET PULSE
          </span>
          <span className="text-[#faff6a] text-2xl">)</span>
        </div>
        
        <nav className="flex gap-6">
          {navItems.map((item) => {
            const Icon = item.icon; 
            const isActive = activeView === item.value || (item.items && item.items.some((child: any) => child.value === activeView));

            if (item.isDropdown && item.items) {
              return (
                <DropdownMenu key={item.value}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-1.5 px-1 pb-1 text-sm transition-colors relative ${ 
                        item.isAdmin
                          ? isActive 
                            ? 'text-[#faff6a] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#faff6a]'
                            : 'text-[#faff6a] hover:text-[#f0f055]'
                          : isActive 
                          ? 'text-[#e5e5e5] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#e5e5e5]'
                          : 'text-[#9ca3af] hover:text-[#e5e5e5]'
                      }`}
                    >
                      <span>{item.label}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isActive ? 'text-white' : 'text-[#9ca3af]'}`} />
                      {item.isAdmin && (
                        <Icon className="w-3 h-3 text-[#faff6a]" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    className="w-48 bg-[#1a1a18] border-[#3a3a35] text-[#e5e5e5]" 
                    align="start"
                  >
                    <DropdownMenuGroup>
                      {item.items.map((child: any) => {
                        const ChildIcon = child.icon;
                        return (
                          <DropdownMenuItem
                            key={child.value}
                            onSelect={() => onViewChange(child.value)}
                            className={`focus:bg-[#2C2C2C] focus:text-[#faff6a] ${
                              activeView === child.value ? 'bg-[#2C2C2C] text-[#faff6a]' : ''
                            }`}
                          >
                            <ChildIcon className="w-4 h-4 mr-2" />
                            <span>{child.label}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <button
                key={item.value}
                onClick={() => onViewChange(item.value)}
                className={`flex items-center gap-2 px-1 pb-1 text-sm transition-colors relative ${
                  item.isAdmin
                    ? isActive 
                      ? 'text-[#faff6a] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#faff6a]'
                      : 'text-[#faff6a] hover:text-[#f0f055]'
                    : isActive 
                    ? 'text-[#e5e5e5] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#e5e5e5]'
                    : 'text-[#9ca3af] hover:text-[#e5e5e5]'
                }`}
              >
                <span>{item.label}</span>
                {item.isAdmin && (
                  <Icon className="w-3 h-3 text-[#faff6a]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {showPropertySelector && (
          <>
            <div className="text-xs text-[#6b7280] mr-1">Property:</div>
            <Select value={property} onValueChange={onPropertyChange}>
              <SelectTrigger className="w-56 h-9 bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a18] border-[#2C2C2C] text-[#e5e5e5]">
                 {properties.map((prop) => (
                  <SelectItem key={prop.property_id} value={prop.property_id.toString()}>
                    {prop.property_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-6 w-px bg-[#3a3a35]" />
          </>
        )}
        
        {/* Last Updated Badge */}
        <div className="text-xs text-[#9ca3af] bg-[#2C2C2C] px-3 py-1.5 rounded">
          {lastUpdatedAt ? (
            `Last updated: ${new Date(lastUpdatedAt).toLocaleString()}`
          ) : (
            'Loading update time...'
          )}
        </div>

        {/* [NEW] Sentinel Notification Bell */}
        {/* Only show for admin/super_admin to reduce noise for basic users, or show for all if needed. */}
        {(userInfo?.role === 'admin' || userInfo?.role === 'super_admin') && (
          <NotificationBell /> 
        )}

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-9 h-9 rounded-full bg-[#faff6a] flex items-center justify-center text-[#1f1f1c] text-xs font-bold ring-offset-2 ring-offset-[#1f1f1c] focus:outline-none focus:ring-2 focus:ring-[#faff6a]">
              {getInitials()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 bg-[#1a1a18] border-[#3a3a35] text-[#e5e5e5]"
            align="end"
            forceMount
          >
            <DropdownMenuLabel className="font-normal px-2 py-1.5">
              <div className="text-sm font-medium truncate">
                {userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : 'Loading...'}
              </div>
              <div className="text-xs text-[#9ca3af] truncate">
                {userInfo ? userInfo.email : '...'}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#3a3a35]" />
            
            <DropdownMenuItem
              className="focus:bg-[#2C2C2C] focus:text-[#faff6a]"
              onSelect={() => onViewChange('settings')}
            >
              <Settings className="w-4 h-4 mr-2" />
              <span>Settings</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="focus:bg-[#2C2C2C] focus:text-[#faff6a]"
              onSelect={() => onViewChange('support')}
            >
              <LifeBuoy className="w-4 h-4 mr-2" />
              <span>Support</span>
            </DropdownMenuItem>
  
            <DropdownMenuItem
              className="focus:bg-[#2C2C2C] focus:text-[#faff6a]"
              onSelect={() => onViewChange('privacy')}
            >
              <Shield className="w-4 h-4 mr-2" />
              <span>Privacy Policy</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="focus:bg-[#2C2C2C] focus:text-[#faff6a]"
              onSelect={() => onViewChange('terms')}
            >
              <FileText className="w-4 h-4 mr-2" />
              <span>Terms of Service</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3a3a35]" />
            <DropdownMenuItem
              className="focus:bg-[#ef4444]/20 focus:text-[#ef4444]"
              onSelect={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span>Log Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}