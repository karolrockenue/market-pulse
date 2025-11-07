import { Button } from './ui/button';
import { Building2, Unplug } from 'lucide-react';
import { toast } from 'sonner'; // [FIX] Corrected import path

// [NEW] Define the correct Property type to match App.tsx
interface Property {
  property_id: number;
  property_name: string;
}

// [NEW] Define the props for this component
interface ConnectedPropertiesProps {
  properties: Property[];
}

export function ConnectedProperties({ properties }: ConnectedPropertiesProps) {
  // [REMOVED] The hardcoded properties array is gone.

  const handleDisconnect = (propertyName: string) => {
    toast.success(`Disconnected from ${propertyName}`);
  };

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-5">
      <h2 className="text-[#e5e5e5] text-lg mb-4">Connected Properties</h2>
      
      <div className="space-y-3">
   {properties.map((property) => (
          <div
            key={property.property_id} // [MODIFIED] Use correct key
            className="flex items-center justify-between p-4 bg-[#1f1f1c] rounded hover:bg-[#3a3a35]/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-[#9ca3af]" />
              <div>
                <div className="text-[#e5e5e5] text-sm">{property.property_name}</div> {/* [MODIFIED] Use correct name */}
                <div className="text-[#9ca3af] text-xs">ID: {property.property_id}</div> {/* [MODIFIED] Use correct ID */}
              </div>
            </div>
            <Button
              onClick={() => handleDisconnect(property.property_name)} // [MODIFIED] Use correct name
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-[#ef4444] hover:text-[#ef4444] hover:bg-[#ef4444]/10"
            >
              <Unplug className="w-3 h-3 mr-1" />
              Disconnect
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}