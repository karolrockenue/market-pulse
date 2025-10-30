import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Building2, Hotel, Sparkles, Star, Crown } from 'lucide-react';
import { toast } from 'sonner'; // [FIX] Correct the import path

interface PropertyClassificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (tier: PropertyTier) => void;
}

export type PropertyTier = 'economy' | 'midscale' | 'upscale' | 'upper-upscale' | 'luxury';

interface TierOption {
  id: PropertyTier;
  name: string;
  description: string;
  icon: typeof Building2;
}

const tierOptions: TierOption[] = [
  {
    id: 'economy',
    name: 'Economy',
    description: 'Essential comfort and value',
    icon: Building2,
  },
  {
    id: 'midscale',
    name: 'Midscale',
    description: 'Balanced comfort and affordability',
    icon: Hotel,
  },
  {
    id: 'upscale',
    name: 'Upscale',
    description: 'Stylish and service-focused',
    icon: Sparkles,
  },
  {
    id: 'upper-upscale',
    name: 'Upper Upscale',
    description: 'High-end service and sophistication',
    icon: Star,
  },
  {
    id: 'luxury',
    name: 'Luxury',
    description: 'Premium experience and amenities',
    icon: Crown,
  },
];

export function PropertyClassificationModal({ 
  isOpen, 
  onClose, 
  onComplete 
}: PropertyClassificationModalProps) {
  const [selectedTier, setSelectedTier] = useState<PropertyTier | null>(null);

  const handleContinue = () => {
    if (selectedTier && onComplete) {
      onComplete(selectedTier);
    }
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
<DialogContent 
        className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]" 
        style={{ maxWidth: '960px' }} // [FIX] Use inline style to bypass static CSS build issue
      >
        <DialogHeader>
          <DialogTitle className="text-[#faff6a] text-2xl">Classify Your Property</DialogTitle>
          <DialogDescription className="text-[#9ca3af] text-sm">
            Select the category that best represents your hotel's position in the market.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Property Category Selector */}
          <div>
            <h3 className="text-[#e5e5e5] text-sm mb-3 uppercase tracking-wider">Property Category</h3>
            <div className="grid grid-cols-5 gap-4">
              {tierOptions.map((tier) => {
                const Icon = tier.icon;
                const isSelected = selectedTier === tier.id;
                
                return (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    className={`p-5 rounded border-2 transition-all hover:border-[#faff6a]/50 ${
                      isSelected
                        ? 'border-[#faff6a] bg-[#faff6a]/10'
                        : 'border-[#3a3a35] bg-[#1f1f1c]'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center gap-3">
                      <Icon 
                        className={`w-10 h-10 ${
                          isSelected ? 'text-[#faff6a]' : 'text-[#9ca3af]'
                        }`}
                      />
                      <div>
                        <div className={`mb-1 ${
                          isSelected ? 'text-[#faff6a]' : 'text-[#e5e5e5]'
                        }`}>
                          {tier.name}
                        </div>
                        <div className="text-[#9ca3af] text-xs leading-tight">
                          {tier.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-[#1f1f1c] rounded p-4 border border-[#3a3a35]">
            <p className="text-[#9ca3af] text-xs leading-relaxed">
              This classification is used for more accurate competitive benchmarking and can be changed later in Settings → Property Details.
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-[#3a3a35]">
          <button
            onClick={handleSkip}
            className="text-[#9ca3af] text-sm hover:text-[#e5e5e5] transition-colors"
          >
            Skip for now
          </button>
          <Button
            onClick={handleContinue}
            disabled={!selectedTier}
            className={`px-8 h-11 text-base ${
              selectedTier
                ? 'bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]'
                : 'bg-[#3a3a35] text-[#6b7280] cursor-not-allowed'
            }`}
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}