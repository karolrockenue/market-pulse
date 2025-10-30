import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { useState } from 'react';
import { Loader2, CheckCircle, Building2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface ConnectMewsModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function ConnectMewsModal({ open, onClose, onComplete }: ConnectMewsModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1 data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [accessToken, setAccessToken] = useState('');

  // Step 2 data - simulating API response
  const [properties] = useState([
    { id: '1', name: 'The Jade Hotel', city: 'London' },
    { id: '2', name: 'Riverside Manor', city: 'Edinburgh' },
    { id: '3', name: 'Coastal Retreat', city: 'Brighton' },
  ]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);

  const handleVerifyAndContinue = async () => {
    if (!firstName || !lastName || !email || !accessToken) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setStep(2);
      toast.success('Token verified successfully!');
    }, 1500);
  };

  const handleConnect = async () => {
    if (selectedProperties.length === 0) {
      toast.error('Please select at least one property');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success('Properties connected successfully!');
      onComplete();
      handleClose();
    }, 1500);
  };

  const handleClose = () => {
    setStep(1);
    setFirstName('');
    setLastName('');
    setEmail('');
    setAccessToken('');
    setSelectedProperties([]);
    onClose();
  };

  const toggleProperty = (propertyId: string) => {
    setSelectedProperties(prev =>
      prev.includes(propertyId)
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#faff6a] text-2xl">Connect to Mews</DialogTitle>
          <DialogDescription className="text-[#9ca3af]">
            {step === 1 
              ? 'Enter your details and Mews access token to get started'
              : 'Select the properties you want to connect'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
                  First Name
                </Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
                />
              </div>
              <div>
                <Label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
                  Last Name
                </Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
                />
              </div>
            </div>

            <div>
              <Label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
                Email Address
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@hotel.com"
                className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
              />
            </div>

            <div>
              <Label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
                Mews Access Token
              </Label>
              <Input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Enter your Mews API token..."
                className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
              />
              <p className="text-[#9ca3af] text-xs mt-2">
                You can find your access token in your Mews account settings
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerifyAndContinue}
                disabled={loading}
                className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Continue'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded p-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#10b981]" />
              <span className="text-[#10b981] text-sm">Token verified! Found {properties.length} properties</span>
            </div>

            <div>
              <Label className="text-[#9ca3af] text-xs mb-3 block uppercase tracking-wider">
                Select Properties
              </Label>
              <div className="space-y-2">
                {properties.map((property) => (
                  <label
                    key={property.id}
                    className={`flex items-center gap-3 p-4 rounded border-2 transition-all cursor-pointer ${
                      selectedProperties.includes(property.id)
                        ? 'bg-[#faff6a]/10 border-[#faff6a]'
                        : 'bg-[#1f1f1c] border-[#3a3a35] hover:border-[#3a3a35]/60'
                    }`}
                  >
                    <Checkbox
                      checked={selectedProperties.includes(property.id)}
                      onCheckedChange={() => toggleProperty(property.id)}
                      className="border-[#3a3a35] data-[state=checked]:bg-[#faff6a] data-[state=checked]:border-[#faff6a]"
                    />
                    <div className="flex items-center gap-3 flex-1">
                      <Building2 className={`w-5 h-5 ${
                        selectedProperties.includes(property.id) ? 'text-[#faff6a]' : 'text-[#9ca3af]'
                      }`} />
                      <div>
                        <div className="text-[#e5e5e5] text-sm">{property.name}</div>
                        <div className="text-[#9ca3af] text-xs">{property.city}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-[#faff6a]/10 border border-[#faff6a]/30 rounded p-3">
              <p className="text-[#faff6a] text-xs">
                {selectedProperties.length} {selectedProperties.length === 1 ? 'property' : 'properties'} selected
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35]"
              >
                Back
              </Button>
              <Button
                onClick={handleConnect}
                disabled={loading || selectedProperties.length === 0}
                className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
