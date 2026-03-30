import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Building2, Hotel, Sparkles, Crown } from 'lucide-react';

interface PropertyClassificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (tier: PropertyTier) => void;
}

export type PropertyTier = 'Hostel' | 'Economy' | 'Midscale' | 'Upper Midscale' | 'Luxury';

interface TierOption {
  id: PropertyTier;
  name: string;
  description: string;
  icon: typeof Building2;
}

const tierOptions: TierOption[] = [
  {
    id: 'Hostel',
    name: 'Hostel',
    description: 'Budget-friendly shared accommodation',
    icon: Building2,
  },
  {
    id: 'Economy',
    name: 'Economy',
    description: 'Essential comfort and value',
    icon: Building2,
  },
  {
    id: 'Midscale',
    name: 'Midscale',
    description: 'Balanced comfort and affordability',
    icon: Hotel,
  },
  {
    id: 'Upper Midscale',
    name: 'Upper Midscale',
    description: 'Stylish and service-focused',
    icon: Sparkles,
  },
  {
    id: 'Luxury',
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="border-0"
        style={{
          maxWidth: '960px',
          backgroundColor: '#1d1d1c',
          border: '1px solid #2a2a2a',
          color: '#e5e5e5',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: '#e5e5e5', fontSize: '20px', fontWeight: 600, letterSpacing: '-0.025em' }}>
            Classify Your Property
          </DialogTitle>
          <DialogDescription style={{ color: '#6b7280', fontSize: '13px' }}>
            Select the category that best represents your hotel's position in the market.
          </DialogDescription>
        </DialogHeader>

        <div style={{ padding: '20px 0' }}>
          {/* Property Category Selector */}
          <div>
            <h3 style={{
              color: '#6b7280',
              fontSize: '10px',
              marginBottom: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Property Category
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
              {tierOptions.map((tier) => {
                const Icon = tier.icon;
                const isSelected = selectedTier === tier.id;

                return (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    style={{
                      padding: '20px 12px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #39BDF8' : '1px solid #2a2a2a',
                      backgroundColor: isSelected ? 'rgba(57, 189, 248, 0.08)' : '#1a1a1a',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = 'rgba(57, 189, 248, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = '#2a2a2a';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px' }}>
                      <Icon style={{
                        width: '32px',
                        height: '32px',
                        color: isSelected ? '#39BDF8' : '#6b7280',
                      }} />
                      <div>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: isSelected ? '#39BDF8' : '#e5e5e5',
                          marginBottom: '4px',
                        }}>
                          {tier.name}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '11px', lineHeight: '1.4' }}>
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
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '6px',
            padding: '12px 16px',
            border: '1px solid #2a2a2a',
            marginTop: '20px',
          }}>
            <p style={{ color: '#6b7280', fontSize: '11px', lineHeight: '1.6', margin: 0 }}>
              This classification is used for more accurate competitive benchmarking and can be changed later in Settings.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '16px',
          borderTop: '1px solid #2a2a2a',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              fontSize: '13px',
              cursor: 'pointer',
              padding: '8px 0',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#e5e5e5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
          >
            Skip for now
          </button>
          <Button
            onClick={handleContinue}
            disabled={!selectedTier}
            style={{
              padding: '0 28px',
              height: '40px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: selectedTier ? 'pointer' : 'not-allowed',
              backgroundColor: selectedTier ? '#39BDF8' : '#2a2a2a',
              color: selectedTier ? '#0d0d0d' : '#6b7280',
            }}
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
