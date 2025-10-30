import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useState } from 'react';
import { toast } from 'sonner@2.0.3';

interface GrantAccessModalProps {
  open: boolean;
  onClose: () => void;
}

export function GrantAccessModal({ open, onClose }: GrantAccessModalProps) {
  const [email, setEmail] = useState('');
  const [property, setProperty] = useState('');

  const handleGrantAccess = () => {
    toast.success(`Access granted to ${email}`);
    onClose();
    setEmail('');
    setProperty('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#faff6a] text-xl">Grant Access</DialogTitle>
          <DialogDescription className="text-[#9ca3af]">
            Give an existing user access to another property
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
              User's Email Address
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
            />
          </div>

          <div>
            <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
              Property to Share
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
            onClick={handleGrantAccess}
            disabled={!email || !property}
            className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]"
          >
            Grant Access
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
