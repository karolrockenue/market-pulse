import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

interface ImportCurvesDialogProps {
  targetHotelId: string;
  sourceHotels: { id: string; name: string }[];
  trigger?: React.ReactNode;
  onSuccess: () => void;
}

export function ImportCurvesDialog({
  targetHotelId,
  sourceHotels,
  trigger,
  onSuccess,
}: ImportCurvesDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImport = async () => {
    if (!selectedSource) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/sentinel/pace-curves/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceHotelId: selectedSource,
          targetHotelId: targetHotelId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      toast.success("Pace curves imported successfully.");
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to import curves.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Copy className="w-4 h-4 mr-2" /> Import
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "#e5e5e5" }}>
            Import Pace Curves
          </DialogTitle>
          <DialogDescription style={{ color: "#9ca3af" }}>
            This will <strong>overwrite</strong> any existing curves for this
            hotel. Select a source hotel to copy from.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label className="text-xs uppercase text-gray-500 font-medium mb-2 block">
            Source Hotel
          </label>
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger
              style={{
                backgroundColor: "#0f0f0f",
                borderColor: "#2a2a2a",
                color: "#e5e5e5",
              }}
            >
              <SelectValue placeholder="Select hotel..." />
            </SelectTrigger>
            <SelectContent
              style={{
                backgroundColor: "#1a1a1a",
                borderColor: "#2a2a2a",
                color: "#e5e5e5",
              }}
            >
              {sourceHotels
                .filter((h) => h.id !== targetHotelId)
                .map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            onClick={() => setOpen(false)}
            variant="ghost"
            style={{ color: "#9ca3af" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedSource || isSubmitting}
            style={{ backgroundColor: "#39BDF8", color: "#0f0f0f" }}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Import Curves
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
