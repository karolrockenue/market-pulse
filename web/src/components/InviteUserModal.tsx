import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useState } from 'react';
import { toast } from 'sonner@2.0.3';

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
}

export function InviteUserModal({ open, onClose }: InviteUserModalProps) {
  const [property, setProperty] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const handleSendInvitation = () => {
    toast.success(`Invitation sent to ${email}`);
    onClose();
    setProperty('');
    setFirstName('');
    setLastName('');
    setEmail('');
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
            <Select value={property} onValueChange={setProperty}>
              <SelectTrigger className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]">
                <SelectValue placeholder="Select property..." />
              </SelectTrigger>
              <SelectContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
                <SelectItem value="HTL001">Grand Plaza Hotel</SelectItem>
                <SelectItem value="HTL002">Seaside Resort</SelectItem>
                <SelectItem value="HTL003">Downtown Suites</SelectItem>
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
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#3a3a35]">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendInvitation}
            disabled={!property || !firstName || !lastName || !email}
            className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]"
          >
            Send Invitation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
