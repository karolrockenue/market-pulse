import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
// Import useEffect and useState
import { useState, useEffect } from 'react';
import { Search, ArrowRight, ArrowLeft, X, RefreshCw } from 'lucide-react';
// Import toast for notifications
import { toast } from 'sonner@2.0.3';

// Define the Hotel type based on our backend data
interface Hotel {
  hotel_id: number;
  property_name: string;
  city: string;
  category: string;
  neighborhood: string;
}

interface ManageCompSetModalProps {
  open: boolean;
  onClose: () => void;
  hotelId: string; // We now receive the hotelId
  hotelName: string;
  allHotels: Hotel[]; // We now receive the full hotel list
}

export function ManageCompSetModal({ open, onClose, hotelId, hotelName, allHotels }: ManageCompSetModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  // States to hold the two lists, now using the correct Hotel interface
  const [currentCompetitors, setCurrentCompetitors] = useState<Hotel[]>([]);
  const [availableHotels, setAvailableHotels] = useState<Hotel[]>([]);

  // States to hold selected IDs. IDs are numbers (hotel_id).
  const [selectedCurrent, setSelectedCurrent] = useState<number[]>([]);
  const [selectedAvailable, setSelectedAvailable] = useState<number[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Effect to fetch the current comp set when the modal is opened
  useEffect(() => {
    // Only run if the modal is open and we have a valid hotelId
    if (open && hotelId) {
      const fetchCompSet = async () => {
        setIsLoading(true);
        // Reset selections
        setSelectedCurrent([]);
        setSelectedAvailable([]);
        setSearchTerm('');

        try {
          // Fetch the current comp set for this hotel
          const response = await fetch(`/api/admin/hotel/${hotelId}/compset`);
          if (!response.ok) throw new Error('Failed to fetch comp set');
          const currentCompSet: Hotel[] = await response.json();

          setCurrentCompetitors(currentCompSet.sort((a, b) => a.property_name.localeCompare(b.property_name)));

          // Determine available hotels
          const currentIds = new Set(currentCompSet.map(h => h.hotel_id));
          // Add the hotel being edited to the set (it can't be its own competitor)
          currentIds.add(parseInt(hotelId, 10));

          // Filter the full list of hotels to find who is available
          const available = allHotels.filter(h => !currentIds.has(h.hotel_id));
          setAvailableHotels(available.sort((a, b) => a.property_name.localeCompare(b.property_name)));

        } catch (error: any) {
          toast.error(`Failed to load comp set: ${error.message}`);
          onClose(); // Close modal on error
        } finally {
          setIsLoading(false);
        }
      };

      fetchCompSet();
    }
  }, [open, hotelId, allHotels, onClose]); // Rerun when these change

  // Filter available hotels based on search term, using the correct property_name
  const filteredAvailable = availableHotels.filter(hotel =>
    hotel.property_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- List Management ---
  const handleAddToCompSet = () => {
    // Find the actual hotel objects to move
    const hotelsToAdd = availableHotels.filter(h => selectedAvailable.includes(h.hotel_id));
    // Add to current, remove from available
    setCurrentCompetitors([...currentCompetitors, ...hotelsToAdd].sort((a, b) => a.property_name.localeCompare(b.property_name)));
    setAvailableHotels(availableHotels.filter(h => !selectedAvailable.includes(h.hotel_id)));
    // Clear selection
    setSelectedAvailable([]);
  };

  const handleRemoveFromCompSet = () => {
    // Find the actual hotel objects to move
    const hotelsToRemove = currentCompetitors.filter(h => selectedCurrent.includes(h.hotel_id));
    // Add to available, remove from current
    setAvailableHotels([...availableHotels, ...hotelsToRemove].sort((a, b) => a.property_name.localeCompare(b.property_name)));
    setCurrentCompetitors(currentCompetitors.filter(h => !selectedCurrent.includes(h.hotel_id)));
    // Clear selection
    setSelectedCurrent([]);
  };

  // --- Save Logic ---
  const handleSave = async () => {
    setIsSaving(true);
    const toastId = toast.loading('Saving comp set...');

    // Get the list of competitor IDs
    const competitorIds = currentCompetitors.map(h => h.hotel_id);

    try {
      // Call the POST endpoint to save the new list
      const response = await fetch(`/api/admin/hotel/${hotelId}/compset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorIds }), // Send the array of IDs
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save changes');
      }

      toast.success('Comp set updated successfully.', { id: toastId });
      onClose(); // Close the modal
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* Ensure the correct classes for width, background, border, text are here */}
{/* REMOVED sm:!max-w-[1200px] to prevent potential conflict */}
{/* Remove Tailwind max-w classes and apply max-width directly via inline style */}
<DialogContent 
  className="w-[95vw] bg-[#262626] border-[#3a3a35] text-[#e5e5e5]" 
  style={{ maxWidth: '1200px' }}
>
        <DialogHeader>
          <DialogTitle className="text-[#faff6a] text-xl">Manage Competitive Set</DialogTitle>
          <DialogDescription className="text-[#9ca3af]">
            {hotelName}
          </DialogDescription>
        </DialogHeader>

        {/* This is the correct two-column grid layout */}
    {/* Apply the grid template columns directly via inline style as a workaround */}
<div 
  className="grid gap-4 py-4" 
  style={{ gridTemplateColumns: '1fr 100px 1fr' }}
>
          {/* Current Competitors */}
          <div className="col-span-1">
            <h3 className="text-[#e5e5e5] mb-3">Current Competitors ({currentCompetitors.length})</h3>
            <div className="bg-[#1f1f1c] rounded border border-[#3a3a35] p-3 h-96 overflow-y-auto relative">
              {isLoading && (
                <div className="absolute inset-0 bg-[#1f1f1c]/50 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-[#faff6a] animate-spin" />
                </div>
              )}
              <div className="space-y-2">
                {currentCompetitors.map(hotel => (
                  <label
                    key={hotel.hotel_id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-[#3a3a35] transition-colors ${
                      selectedCurrent.includes(hotel.hotel_id) ? 'bg-[#faff6a]/10 border border-[#faff6a]' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCurrent.includes(hotel.hotel_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCurrent([...selectedCurrent, hotel.hotel_id]);
                        } else {
                          setSelectedCurrent(selectedCurrent.filter(id => id !== hotel.hotel_id));
                        }
                      }}
                      className="rounded border-[#3a3a35]"
                    />
                    <span className="text-[#e5e5e5] text-sm">{hotel.property_name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="col-span-1 flex flex-col items-center justify-center gap-3">
            <Button
              onClick={handleRemoveFromCompSet}
              disabled={selectedCurrent.length === 0}
              variant="outline"
              className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] w-full h-12"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button
              onClick={handleAddToCompSet}
              disabled={selectedAvailable.length === 0}
              variant="outline"
              className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] w-full h-12"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>

          {/* Available Hotels */}
          <div className="col-span-1">
            <h3 className="text-[#e5e5e5] mb-3">Available Hotels</h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search hotels..."
                className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] pl-10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-[#9ca3af] hover:text-[#e5e5e5]" />
                </button>
              )}
            </div>
            {/* Height adjusted to h-80 */}
            <div className="bg-[#1f1f1c] rounded border border-[#3a3a35] p-3 h-80 overflow-y-auto relative">
              {isLoading && (
                <div className="absolute inset-0 bg-[#1f1f1c]/50 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-[#faff6a] animate-spin" />
                </div>
              )}
              <div className="space-y-2">
                {filteredAvailable.map(hotel => (
                  <label
                    key={hotel.hotel_id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-[#3a3a35] transition-colors ${
                      selectedAvailable.includes(hotel.hotel_id) ? 'bg-[#faff6a]/10 border border-[#faff6a]' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAvailable.includes(hotel.hotel_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAvailable([...selectedAvailable, hotel.hotel_id]);
                        } else {
                          setSelectedAvailable(selectedAvailable.filter(id => id !== hotel.hotel_id));
                        }
                      }}
                      className="rounded border-[#3a3a35]"
                    />
                    <span className="text-[#e5e5e5] text-sm">{hotel.property_name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* End of the correct grid layout */}

        {/* Save/Cancel buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-[#3a3a35]">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a] disabled:opacity-50"
            disabled={isSaving || isLoading}
          >
            {isSaving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}