import { Button } from './ui/button';
import { UserPlus, Shield, Trash2 } from 'lucide-react';

interface User {
  // [MODIFIED] Update fields to match the database schema
  user_id: string; // Changed from id
  first_name: string; // Changed from name
  last_name: string;
  email: string;
  role: string;
  // 'status' is not provided by the API, so we'll remove it or derive it if needed.
  // For now, let's assume all fetched users are 'Active'.
}
interface UserManagementProps {
  onInviteUser: () => void;
  onGrantAccess: () => void;
  onRemoveUser: (userId: string) => void;
  users: User[]; // [NEW] Accept a 'users' prop with live data
}

// [MODIFIED] Destructure the 'users' prop and remove mock data
export function UserManagement({ onInviteUser, onGrantAccess, onRemoveUser, users }: UserManagementProps) {
  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#3a3a35] flex items-center justify-between">
        <h2 className="text-[#e5e5e5] text-lg">User Management</h2>
        <div className="flex gap-3">
          <Button
            onClick={onInviteUser}
            className="bg-[#2C2C2C] border border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] h-9"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
          <Button
            onClick={onGrantAccess}
            className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a] h-9"
          >
            <Shield className="w-4 h-4 mr-2" />
            Grant Access
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#3a3a35] bg-[#1f1f1c]">
              <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
<tbody>
            {/* [MODIFIED] Use live data from props */}
            {users.map((user) => (
              // [MODIFIED] Use 'user_id' as the key
              <tr key={user.user_id} className="border-b border-[#3a3a35] hover:bg-[#3a3a35]/30 transition-colors">
                {/* [MODIFIED] Combine first and last name */}
                <td className="px-6 py-4 text-[#e5e5e5] text-sm">{user.first_name} {user.last_name}</td>
                <td className="px-6 py-4 text-[#9ca3af] text-sm">{user.email}</td>
                <td className="px-6 py-4">
                  {/* [MODIFIED] Check for 'owner' (lowercase) or 'super_admin' */}
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                    user.role === 'owner' || user.role === 'super_admin'
                      ? 'bg-[#faff6a]/10 text-[#faff6a] border border-[#faff6a]/30'
                      : 'bg-[#3a3a35] text-[#e5e5e5]'
                  }`}>
                    {user.role}
                  </span>
                </td>
            <td className="px-6 py-4">
                  {/* [MODIFIED] Assuming all users from this API are 'Active'. 
                      We can update this later if the API provides a status. */}
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-[#10b981]/10 text-[#10b981]">
                    Active
                  </span>
                </td>
           <td className="px-6 py-4">
                  {/* [MODIFIED] Check for 'owner' (lowercase) or 'super_admin' */}
                  {user.role !== 'owner' && user.role !== 'super_admin' && (
                    <Button
                      // [MODIFIED] Pass 'user_id' to the handler
                      onClick={() => onRemoveUser(user.user_id)}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-[#ef4444] hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
