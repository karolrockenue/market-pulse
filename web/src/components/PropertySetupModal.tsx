import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { useState } from 'react';
import { Building2, DollarSign, TrendingUp, Home, Star } from 'lucide-react';
import { toast } from 'sonner'; // [FIX] Correct the import path

interface PropertySetupModalProps {
  open: boolean;
  onComplete: () => void;
}

export function PropertySetupModal({ open, onComplete }: PropertySetupModalProps) {
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [taxRate, setTaxRate] = useState('');
  const [taxType, setTaxType] = useState<'inclusive' | 'exclusive'>('exclusive');
  const [taxName, setTaxName] = useState('');
  
  // Simulating missing tax info detection
  const [showTaxSection] = useState(true);

  const tiers = [
    {
      id: 'hostel',
      name: 'Hostel',
      icon: Home,
      description: 'Shared accommodations, basic amenities',
      color: '#9ca3af',
    },
    {
      id: 'economy',
      name: 'Economy',
      icon: Building2,
      description: 'Budget-friendly, essential services',
      color: '#f59e0b',
    },
    {
      id: 'midscale',
      name: 'Midscale',
      icon: Building2,
      description: 'Comfortable rooms, standard amenities',
      color: '#10b981',
    },
    {
      id: 'upper-midscale',
      name: 'Upper Midscale',
      icon: TrendingUp,
      description: 'Enhanced services, quality facilities',
      color: '#3b82f6',
    },
    {
      id: 'luxury',
      name: 'Luxury',
      icon: Star,
      description: 'Premium experience, full-service',
      color: '#faff6a',
    },
  ];

  const handleComplete = () => {
    if (!selectedTier) {
      toast.error('Please select a property tier');
      return;
    }
    if (showTaxSection && (!taxRate || !taxName)) {
      toast.error('Please complete tax information');
      return;
    }
    toast.success('Property setup complete!');
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5] max-w-3xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-[#faff6a] text-2xl">One Last Step</DialogTitle>
          <DialogDescription className="text-[#9ca3af] text-sm">
            Select the category that best describes your hotel to ensure accurate market comparisons.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quality Tier Selector */}
          <div>
            <h3 className="text-[#e5e5e5] text-sm mb-3 uppercase tracking-wider">Property Category</h3>
            <div className="grid grid-cols-5 gap-3">
              {tiers.map((tier) => {
                const Icon = tier.icon;
                const isSelected = selectedTier === tier.id;
                
                return (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    className={`p-4 rounded border-2 transition-all hover:border-[#faff6a]/50 ${
                      isSelected
                        ? 'border-[#faff6a] bg-[#faff6a]/10'
                        : 'border-[#3a3a35] bg-[#1f1f1c]'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center gap-2">
                      <Icon 
                        className={`w-8 h-8 ${
                          isSelected ? 'text-[#faff6a]' : 'text-[#9ca3af]'
                        }`}
                      />
                      <div>
                        <div className={`text-sm mb-1 ${
                          isSelected ? 'text-[#faff6a]' : 'text-[#e5e5e5]'
                        }`}>
                          {tier.name}
                        </div>
                        <div className="text-[#9ca3af] text-[10px] leading-tight">
                          {tier.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tax Information Section (Conditional) */}
          {showTaxSection && (
            <div className="border-t border-[#3a3a35] pt-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-4 h-4 text-[#faff6a]" />
                <h3 className="text-[#e5e5e5] text-sm uppercase tracking-wider">Tax Information</h3>
              </div>

              <div className="bg-[#1f1f1c] rounded p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
                      Tax Rate (%)
                    </Label>
                    <Input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      placeholder="14.5"
                      className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]"
                    />
                  </div>

                  <div>
                    <Label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
                      Tax Name
                    </Label>
                    <Input
                      value={taxName}
                      onChange={(e) => setTaxName(e.target.value)}
                      placeholder="VAT"
                      className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[#9ca3af] text-xs mb-3 block uppercase tracking-wider">
                    Tax Type
                  </Label>
                  <RadioGroup value={taxType} onValueChange={(value: any) => setTaxType(value)}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem 
                          value="inclusive" 
                          id="inclusive"
                          className="border-[#3a3a35] text-[#faff6a]"
                        />
                        <Label htmlFor="inclusive" className="text-[#e5e5e5] text-sm cursor-pointer">
                          <div className="mb-1">Tax Inclusive</div>
                          <div className="text-[#9ca3af] text-xs">Tax is included in the displayed rate</div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem 
                          value="exclusive" 
                          id="exclusive"
                          className="border-[#3a3a35] text-[#faff6a]"
                        />
                        <Label htmlFor="exclusive" className="text-[#e5e5e5] text-sm cursor-pointer">
                          <div className="mb-1">Tax Exclusive</div>
                          <div className="text-[#9ca3af] text-xs">Tax is added on top of the rate</div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <div className="flex justify-end pt-4 border-t border-[#3a3a35]">
          <Button
            onClick={handleComplete}
            disabled={!selectedTier || (showTaxSection && (!taxRate || !taxName))}
            className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a] px-8 h-11 text-base"
          >
            Complete Setup & View Dashboard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
