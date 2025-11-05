// [MODIFIED] Import new icons for Planning dropdown
import {
  BarChart3,
  LayoutDashboard,
  FileText, // [FIX] This is the correct icon name
  Settings,
  Shield, // [FIX] This is the correct icon name
  RefreshCw,
  Sliders,
  LifeBuoy,
  LogOut,
  Zap, // [NEW] Add Zap icon for admin/rockenue links
  ClipboardList, // [NEW] Replaced Target with ClipboardList
  ChevronDown, // [NEW] Icon for dropdown arrow
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
// [MODIFIED] Import DropdownMenu components, including DropdownMenuGroup
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup, // [NEW] Import DropdownMenuGroup
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

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
  // Add the new prop to accept the timestamp (or null if not loaded)
  lastUpdatedAt: string | null;
  // [NEW] Add prop to accept the user info object
// [MODIFIED] Add user's role to the userInfo object for RBAC
  userInfo: { firstName: string; lastName: string; email: string; role: string; } | null;
}

// Add lastUpdatedAt to the destructured props
export function TopNav({ activeView, onViewChange, property, onPropertyChange, properties, lastUpdatedAt, userInfo }: TopNavProps) {

  // [NEW] Helper function to get initials from the user info
  const getInitials = () => {
    if (userInfo) {
      const firstInitial = userInfo.firstName ? userInfo.firstName.charAt(0) : '';
      const lastInitial = userInfo.lastName ? userInfo.lastName.charAt(0) : '';
      return `${firstInitial}${lastInitial}`.toUpperCase();
    }
    return '...'; // Loading state
  };


  // [NEW] Add a handler function for logging out
  const handleLogout = async () => {
    try {
      // Call the logout endpoint
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // Reload the page to trigger the session check in App.tsx
      window.location.reload();
    }
  };
// [MODIFIED] Update navItems to remove dropdowns and re-order
const allNavItems = [
    { label: 'Dashboard', value: 'dashboard', icon: LayoutDashboard, isAdmin: false },
    { label: 'Reports', value: 'reports', icon: FileText, isAdmin: false },
    
    // [NEW] "Planning" items are now top-level.
    { label: 'Budget', value: 'budget', icon: ClipboardList, isAdmin: false },
    { label: 'Demand & Pace', value: 'demand-pace', icon: BarChart3, isAdmin: false },

    // [REMOVED] "Market Overview" has been deleted.

    // [MODIFIED] Admin links are now at the end.
    { label: 'Rockenue', value: 'rockenue', icon: Zap, isAdmin: true },
    { label: 'Admin', value: 'admin', icon: Zap, isAdmin: true },
  ];

  // [NEW] Filter nav items based on user role, only show admin items to super_admin
  const navItems = allNavItems.filter(item => {
    // If it's not an admin item, always show it
    if (!item.isAdmin) {
      return true;
    }
    // If it IS an admin item, only show it if the user is a super_admin
    return userInfo?.role === 'super_admin';
  });

const showPropertySelector = activeView !== 'landing';

  return (
    <div className="bg-[#1f1f1c] border-b border-[#3a3a35] px-6 py-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-[#faff6a]" />
          <div className="text-[#faff6a] tracking-widest">MARKET PULSE</div>
        </div>
        
<nav className="flex gap-6">
          {/* [MODIFIED] Use prototype's rendering logic for admin-specific styling */}
          {navItems.map((item) => {
            const Icon = item.icon; // Get the icon component from the item
            
            // [NEW] Check if the active view is one of this item's children (if it's a dropdown)
            const isActive = activeView === item.value || (item.items && item.items.some((child: any) => child.value === activeView));

            // [NEW] Logic to render a dropdown or a simple button
            if (item.isDropdown && item.items) {
              return (
 <DropdownMenu key={item.value}>
                  <DropdownMenuTrigger asChild>
                    <button
                      // [MODIFIED] This className logic applies the yellow styling for admin links
                      className={`flex items-center gap-1.5 px-1 pb-1 text-sm transition-colors relative ${ // [MODIFIED] gap-1.5
                        item.isAdmin
                          ? isActive // Admin link styles
                            ? 'text-[#faff6a] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#faff6a]'
                            : 'text-[#faff6a] hover:text-[#f0f055]'
                          : isActive // Regular link styles
                          ? 'text-[#e5e5e5] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#e5e5e5]'
                          : 'text-[#9ca3af] hover:text-[#e5e5e5]'
                      }`}
                    >
                      <span>{item.label}</span>
                      {/* [NEW] Add dropdown arrow */}
                      <ChevronDown className={`w-3 h-3 transition-transform ${isActive ? 'text-white' : 'text-[#9ca3af]'}`} />
                      {/* [NEW] Render the icon only if it's an admin link */}
                      {item.isAdmin && (
                        <Icon className="w-3 h-3 text-[#faff6a]" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  {/* [MODIFIED] Added align="start" to fix alignment */}
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
                            className={`focus:bg-[#262626] focus:text-[#faff6a] ${
                              activeView === child.value ? 'bg-[#262626] text-[#faff6a]' : ''
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

            // [OLD] This is the original logic for simple buttons
            return (
              <button
                key={item.value}
                onClick={() => onViewChange(item.value)}
                // [NEW] This className logic applies the yellow styling for admin links
                className={`flex items-center gap-2 px-1 pb-1 text-sm transition-colors relative ${
                  item.isAdmin
                    ? isActive // Admin link styles
                      ? 'text-[#faff6a] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#faff6a]'
                      : 'text-[#faff6a] hover:text-[#f0f055]'
                    : isActive // Regular link styles
                    ? 'text-[#e5e5e5] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#e5e5e5]'
                    : 'text-[#9ca3af] hover:text-[#e5e5e5]'
                }`}
              >
                <span>{item.label}</span>
                {/* [NEW] Render the icon only if it's an admin link */}
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
              <SelectTrigger className="w-56 h-9 bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a18] border-[#262626] text-[#e5e5e5]">
     {properties.map((prop) => (
                  // Use the correct property name 'property_id' from the API data.
                  <SelectItem key={prop.property_id} value={prop.property_id.toString()}>
                    {prop.property_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-6 w-px bg-[#3a3a35]" />
          </>
        )}
<div className="text-xs text-[#9ca3af] bg-[#262626] px-3 py-1.5 rounded">
          {/* Check if the lastUpdatedAt prop is loaded */}
          {lastUpdatedAt ? (
            // If loaded, create a Date object and format it to a time string
            `Last updated: ${new Date(lastUpdatedAt).toLocaleTimeString()}`
          ) : (
            // Otherwise, show a loading message
            'Loading update time...'
          )}
        </div>
   {/* [NEW] Replace the static div with a DropdownMenu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-9 h-9 rounded-full bg-[#faff6a] flex items-center justify-center text-[#1f1f1c] text-xs font-bold ring-offset-2 ring-offset-[#1f1f1c] focus:outline-none focus:ring-2 focus:ring-[#faff6a]">
              {/* [NEW] Use dynamic initials */}
              {getInitials()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 bg-[#1a1a18] border-[#3a3a35] text-[#e5e5e5]"
            align="end"
            forceMount
          >
            <DropdownMenuLabel className="font-normal px-2 py-1.5">
              {/* [NEW] Use dynamic user info, with fallbacks */}
              <div className="text-sm font-medium truncate">
                {userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : 'Loading...'}
              </div>
              <div className="text-xs text-[#9ca3af] truncate">
                {userInfo ? userInfo.email : '...'}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#3a3a35]" />
   {/* [NEW] Add menu items that use the onViewChange prop to navigate */}
{/* [NEW] Add menu items that use the onViewChange prop to navigate */}
   {/* [NEW] Add Settings link to dropdown */}
            <DropdownMenuItem
              className="focus:bg-[#262626] focus:text-[#faff6a]"
              onSelect={() => onViewChange('settings')}
            >
              <Settings className="w-4 h-4 mr-2" />
              <span>Settings</span>
            </DropdownMenuItem>

            {/* [FIX] Re-enabled the Support menu item */}
            <DropdownMenuItem
              className="focus:bg-[#262626] focus:text-[#faff6a]"
              onSelect={() => onViewChange('support')}
            >
              <LifeBuoy className="w-4 h-4 mr-2" />
              <span>Support</span>
            </DropdownMenuItem>{/* [NEW] Add menu items that use the onViewChange prop to navigate */}
  
          <DropdownMenuItem
              className="focus:bg-[#262626] focus:text-[#faff6a]"
              onSelect={() => onViewChange('privacy')}
            >
              {/* [FIX] Changed from FileShield to Shield */}
              <Shield className="w-4 h-4 mr-2" />
              <span>Privacy Policy</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="focus:bg-[#262626] focus:text-[#faff6a]"
              onSelect={() => onViewChange('terms')}
            >
              {/* [FIX] Changed from FileTextIcon to FileText */}
              <FileText className="w-4 h-4 mr-2" />
              <span>Terms of Service</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3a3a35]" />
            {/* [NEW] Logout item that calls the new handler */}
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