import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { MyProfile } from './MyProfile';
import { UserManagement } from './UserManagement';
import { ConnectedProperties } from './ConnectedProperties';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { User, Users, Building2, Bell, Lock, Settings, Zap, Save } from 'lucide-react';
// SettingsPage.tsx
import { toast } from 'sonner'; // [FIX] Corrected import path

// [NEW] Define the userInfo type
interface UserInfo {
  firstName: string;
  lastName: string;
  email: string;
}

// [NEW] Define the Property type (copied from App.tsx)
interface Property {
  property_id: number;
  property_name: string;
}

interface SettingsPageProps {
  userInfo: UserInfo | null; // Add userInfo prop
  onUpdateProfile: (firstName: string, lastName: string) => void; // Add handler prop
  onInviteUser: () => void;
  onGrantAccess: () => void;
  onRemoveUser: (userId: string) => void;
  teamMembers: any[]; // Add prop to receive team members
  properties: Property[]; // [NEW] Add prop to receive the properties list
}

export function SettingsPage({ 
  userInfo, 
  onUpdateProfile, 
  onInviteUser, 
  onGrantAccess, 
onRemoveUser,
  teamMembers, // Destructure the new prop
  properties // [NEW] Destructure the properties prop
}: SettingsPageProps) {
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [reportNotifications, setReportNotifications] = useState(true);
  const [marketAlerts, setMarketAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  // Security settings
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30');

  // Preferences
  const [defaultView, setDefaultView] = useState('dashboard');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('UTC-5');

  const handleSaveNotifications = () => {
    toast.success('Notification preferences saved');
  };

  const handleSaveSecurity = () => {
    toast.success('Security settings updated');
  };

  const handleSavePreferences = () => {
    toast.success('Preferences saved');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-white text-2xl mb-2">Settings</h1>
        <p className="text-[#9ca3af] text-sm">Manage your account, team, and application preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-[#1a1a18] border border-[#3a3a35] p-1 inline-flex gap-1">
          <TabsTrigger 
            value="profile" 
            className="data-[state=active]:bg-[#faff6a] data-[state=active]:text-[#1a1a18] text-[#9ca3af] px-4 py-2"
          >
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger 
            value="team" 
            className="data-[state=active]:bg-[#faff6a] data-[state=active]:text-[#1a1a18] text-[#9ca3af] px-4 py-2"
          >
            <Users className="w-4 h-4 mr-2" />
            Team & Users
          </TabsTrigger>
          <TabsTrigger 
            value="properties" 
            className="data-[state=active]:bg-[#faff6a] data-[state=active]:text-[#1a1a18] text-[#9ca3af] px-4 py-2"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Properties
          </TabsTrigger>
 <TabsTrigger 
            value="notifications" 
            className="data-[state=active]:bg-[#faff6a] data-[state=active]:text-[#1a1a18] text-[#9ca3af] px-4 py-2"
          >
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          {/* [REMOVED] Security Tab Trigger */}
          {/* [REMOVED] Preferences Tab Trigger */}
          <TabsTrigger 
            value="integrations"
            className="data-[state=active]:bg-[#faff6a] data-[state=active]:text-[#1a1a18] text-[#9ca3af] px-4 py-2"
          >
            <Zap className="w-4 h-4 mr-2" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          {/* [MODIFIED] Pass the props to MyProfile */}
          <MyProfile 
            userInfo={userInfo}
            onSave={onUpdateProfile}
          />
          
          <div className="bg-[#262626] rounded border border-[#3a3a35] p-5">
            <h3 className="text-[#e5e5e5] mb-4">Authentication Method</h3>
            <div className="flex items-start gap-4 p-4 bg-[#1f1f1c] rounded">
              <div className="w-10 h-10 bg-[#faff6a]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-[#faff6a]" />
              </div>
              <div>
                <div className="text-[#e5e5e5] text-sm mb-1">Magic Link Authentication</div>
                <div className="text-[#9ca3af] text-xs leading-relaxed">
                  Your account uses passwordless magic link authentication. Each time you log in, 

                  {/* [MODIFIED] Display the email from the userInfo prop */}
                  we'll send a secure link to <span className="text-[#faff6a]">{userInfo?.email || 'your email'}</span> for instant access.
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

{/* Team & Users Tab */}
        <TabsContent value="team">
          <UserManagement
            onInviteUser={onInviteUser}
            onGrantAccess={onGrantAccess}
            onRemoveUser={onRemoveUser}
            users={teamMembers} // [NEW] Pass the live data to the 'users' prop
          />
        </TabsContent>

   {/* Properties Tab */}
        <TabsContent value="properties">
          <ConnectedProperties properties={properties} /> {/* [NEW] Pass properties down */}
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="bg-[#262626] rounded border border-[#3a3a35] p-5">
            <h3 className="text-[#e5e5e5] mb-4">Email Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-[#3a3a35]">
                <div>
                  <div className="text-[#e5e5e5] text-sm mb-1">General Email Notifications</div>
                  <div className="text-[#9ca3af] text-xs">Receive emails about account activity and updates</div>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-[#3a3a35]">
                <div>
                  <div className="text-[#e5e5e5] text-sm mb-1">Report Completion Notifications</div>
                  <div className="text-[#9ca3af] text-xs">Get notified when scheduled reports are generated</div>
                </div>
                <Switch
                  checked={reportNotifications}
                  onCheckedChange={setReportNotifications}
                />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-[#3a3a35]">
                <div>
                  <div className="text-[#e5e5e5] text-sm mb-1">Market Alerts</div>
                  <div className="text-[#9ca3af] text-xs">Alerts for significant market changes or ranking shifts</div>
                </div>
                <Switch
                  checked={marketAlerts}
                  onCheckedChange={setMarketAlerts}
                />
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="text-[#e5e5e5] text-sm mb-1">Weekly Digest</div>
                  <div className="text-[#9ca3af] text-xs">Receive a summary of your performance every Monday</div>
                </div>
                <Switch
                  checked={weeklyDigest}
                  onCheckedChange={setWeeklyDigest}
                />
              </div>
            </div>

            <div className="mt-6">
              <Button 
                onClick={handleSaveNotifications}
                className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Notification Settings
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Security Tab */}
        

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="bg-[#262626] rounded border border-[#3a3a35] p-5">
            <h3 className="text-[#e5e5e5] mb-4">Connected Integrations</h3>
            
            <div className="space-y-3">
              <div className="p-4 bg-[#1f1f1c] rounded border border-[#3a3a35] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#faff6a]/10 rounded flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-[#faff6a]" />
                  </div>
                  <div>
                    <div className="text-[#e5e5e5] text-sm">Mews PMS</div>
                    <div className="text-[#9ca3af] text-xs">Property Management System</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#10b981] text-xs bg-[#10b981]/10 px-2 py-1 rounded">Connected</span>
                  <Button variant="ghost" size="sm" className="text-[#9ca3af] hover:text-[#e5e5e5]">
                    Configure
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-[#1f1f1c] rounded border border-[#3a3a35] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#faff6a]/10 rounded flex items-center justify-center">
                    <Zap className="w-6 h-6 text-[#faff6a]" />
                  </div>
                  <div>
                    <div className="text-[#e5e5e5] text-sm">Cloudbeds</div>
                    <div className="text-[#9ca3af] text-xs">Hotel Management Platform</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#9ca3af] text-xs bg-[#3a3a35] px-2 py-1 rounded">Not Connected</span>
                  <Button className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a] h-8">
                    Connect
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-[#1f1f1c] rounded border border-[#3a3a35] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#faff6a]/10 rounded flex items-center justify-center">
                    <Bell className="w-6 h-6 text-[#faff6a]" />
                  </div>
                  <div>
                    <div className="text-[#e5e5e5] text-sm">Slack</div>
                    <div className="text-[#9ca3af] text-xs">Team Communication</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#9ca3af] text-xs bg-[#3a3a35] px-2 py-1 rounded">Not Connected</span>
                  <Button className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a] h-8">
                    Connect
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-6">
            <div className="text-center max-w-md mx-auto">
              <h4 className="text-[#e5e5e5] mb-2">Need More Integrations?</h4>
              <p className="text-[#9ca3af] text-sm mb-4">
                Contact our support team to request additional integrations for your property management workflow.
              </p>
              <Button className="bg-[#262626] border border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35]">
                Request Integration
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}