import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useState, useEffect } from 'react';
// [THE FIX] Remove toast, it will be handled by App.tsx
// import { toast } from 'sonner@2.0.3'; 

// [THE FIX] Define an interface for the property prop
interface Property {
  property_id: number;
  property_name: string;
}

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  // [THE FIX] Add properties prop
  properties: Property[];
  // [THE FIX] Add a handler to send data up to App.tsx
  onSendInvite: (data: {
    email: string;
    firstName: string;
    lastName: string;
    propertyId: string;
  }) => void;
  isLoading: boolean; // [THE FIX] Add loading state from parent
}

export function InviteUserModal({ open, onClose, properties, onSendInvite, isLoading }: InviteUserModalProps) {
  const [propertyId, setPropertyId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // [THE FIX] Clear form when modal is closed
  useEffect(() => {
    if (!open) {
      setPropertyId('');
      setFirstName('');
      setLastName('');
      setEmail('');
    }
  }, [open]);

  // [THE FIX] This function now passes data up to the parent (App.tsx)
  // instead of showing a fake toast.
  const handleSendInvitation = () => {
    onSendInvite({
      email,
      firstName,
      lastName,
      propertyId,
    });
    // The parent will handle the toast and closing the modal on success
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#faff6a] text-xl">Invite User</DialogTitle>
          <DialogDescription className="text-[#9ca3af]">
            Send an invitation to join your team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
              Property
            </label>
            {/* [THE FIX] Use the 'properties' prop to render the list */}
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]">
                <SelectValue placeholder="Select property..." />
              </SelectTrigger>
              <SelectContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
                {properties.map((prop) => (
                  <SelectItem key={prop.property_id} value={prop.property_id.toString()}>
                    {prop.property_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
                First Name
              </label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
                Last Name
              </label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
              Email Address
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john.doe@example.com"
              className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#3a3a35]">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35]"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendInvitation}
            disabled={!propertyId || !firstName || !lastName || !email || isLoading}
            className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]"
          >
            {/* [THE FIX] Show loading state */}
            {isLoading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}