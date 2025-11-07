// MyProfile.tsx
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useState, useEffect } from 'react'; // [MODIFIED] Import useEffect
import { Save } from 'lucide-react';
import { toast } from 'sonner'; // [FIX] Corrected import path

// [NEW] Define the props
interface UserInfo {
  firstName: string;
  lastName: string;
  email: string;
}

interface MyProfileProps {
  userInfo: UserInfo | null;
  onSave: (firstName: string, lastName: string) => void;
}

export function MyProfile({ userInfo, onSave }: MyProfileProps) {
  // [MODIFIED] Initialize state from props
  const [firstName, setFirstName] = useState(userInfo?.firstName || '');
  const [lastName, setLastName] = useState(userInfo?.lastName || '');
  const [hasChanges, setHasChanges] = useState(false);

  // [NEW] Add an effect to update state if props load *after* component mounts
  useEffect(() => {
    if (userInfo) {
      setFirstName(userInfo.firstName || '');
      setLastName(userInfo.lastName || '');
    }
  }, [userInfo]);

  // [MODIFIED] Call the onSave prop passed from App.tsx
  const handleSave = () => {
    onSave(firstName, lastName);
    setHasChanges(false);
  };

  const handleChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setHasChanges(true);
  };

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-5">
      <h2 className="text-[#e5e5e5] text-lg mb-4">My Profile</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
            First Name
          </label>
          <Input
            value={firstName}
            onChange={(e) => handleChange(setFirstName)(e.target.value)}
            className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
          />
        </div>

        <div>
          <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
            Last Name
          </label>
          <Input
            value={lastName}
            onChange={(e) => handleChange(setLastName)(e.target.value)}
            className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
          Email Address
        </label>
        {/* [MODIFIED] Use prop for email */}
        <Input
          // [FIX] Use ?? '' to show empty string for null/undefined
          value={userInfo?.email ?? ''} 
          disabled
          className="bg-[#1f1f1c]/50 border-[#3a3a35] text-[#9ca3af] cursor-not-allowed"
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={!hasChanges}
        className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Save className="w-4 h-4 mr-2" />
        Save Changes
      </Button>
    </div>
  );
}