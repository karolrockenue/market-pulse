import { useState, useEffect } from "react";
import { X, Search, Check } from "lucide-react";
import { toast } from "sonner";

interface CompSetHotel {
  hotel_id: number;
  property_name: string;
  category: string;
  city: string;
}

interface ManageCompSetModalProps {
  hotelId: string;
  hotelName: string;
  allHotels: { hotel_id: number; property_name: string; category: string; city: string }[];
  onClose: () => void;
}

export function ManageCompSetModal({
  hotelId,
  hotelName,
  allHotels,
  onClose,
}: ManageCompSetModalProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch current comp set on mount
  useEffect(() => {
    const fetchCompSet = async () => {
      try {
        const res = await fetch(`/api/hotels/${hotelId}/compset`);
        if (!res.ok) throw new Error("Failed to fetch comp set");
        const data: CompSetHotel[] = await res.json();
        setSelectedIds(new Set(data.map((h) => h.hotel_id)));
      } catch {
        toast.error("Failed to load current comp set");
      } finally {
        setLoading(false);
      }
    };
    fetchCompSet();
  }, [hotelId]);

  const handleToggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/hotels/${hotelId}/compset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorIds: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Comp set updated");
      onClose();
    } catch {
      toast.error("Failed to save comp set");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSelectedIds(new Set());
  };

  // Get the primary hotel's city, then filter to same city only
  const primaryHotel = allHotels.find((h) => h.hotel_id.toString() === hotelId);
  const primaryCity = primaryHotel?.city || null;

  const otherHotels = allHotels.filter(
    (h) => h.hotel_id.toString() !== hotelId && h.city === primaryCity
  );
  const filtered = search
    ? otherHotels.filter((h) =>
        h.property_name.toLowerCase().includes(search.toLowerCase())
      )
    : otherHotels;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: "12px",
          width: "480px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #2a2a2a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h2
              style={{
                color: "#e5e5e5",
                fontSize: "16px",
                fontWeight: 600,
                margin: 0,
              }}
            >
              Manage Comp Set
            </h2>
            <p
              style={{
                color: "#9ca3af",
                fontSize: "12px",
                margin: "4px 0 0",
              }}
            >
              {hotelName}{primaryCity ? ` · ${primaryCity}` : ""} — {selectedIds.size} competitor
              {selectedIds.size !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#9ca3af",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid #2a2a2a" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#2C2C2C",
              borderRadius: "6px",
              padding: "8px 12px",
            }}
          >
            <Search size={14} style={{ color: "#6b7280" }} />
            <input
              type="text"
              placeholder="Search hotels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: "none",
                border: "none",
                outline: "none",
                color: "#e5e5e5",
                fontSize: "13px",
                width: "100%",
              }}
            />
          </div>
        </div>

        {/* Hotel List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 12px",
          }}
        >
          {loading ? (
            <p
              style={{
                color: "#9ca3af",
                fontSize: "13px",
                textAlign: "center",
                padding: "24px",
              }}
            >
              Loading...
            </p>
          ) : (
            filtered.map((hotel) => {
              const isSelected = selectedIds.has(hotel.hotel_id);
              return (
                <button
                  key={hotel.hotel_id}
                  onClick={() => handleToggle(hotel.hotel_id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: isSelected
                      ? "rgba(57, 189, 248, 0.08)"
                      : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "4px",
                      border: isSelected
                        ? "1.5px solid #39BDF8"
                        : "1.5px solid #6b7280",
                      backgroundColor: isSelected ? "#39BDF8" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <Check size={12} style={{ color: "#1a1a1a" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: "#e5e5e5",
                        fontSize: "13px",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {hotel.property_name}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "11px" }}>
                      {hotel.category || "Uncategorised"} · {hotel.city || "—"}
                    </div>
                  </div>
                </button>
              );
            })
          )}
          {!loading && filtered.length === 0 && (
            <p
              style={{
                color: "#6b7280",
                fontSize: "13px",
                textAlign: "center",
                padding: "24px",
              }}
            >
              No hotels match your search
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #2a2a2a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            onClick={handleClear}
            style={{
              background: "none",
              border: "none",
              color: "#9ca3af",
              fontSize: "12px",
              cursor: "pointer",
              padding: "6px 0",
            }}
          >
            Clear all (use category fallback)
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #2a2a2a",
                backgroundColor: "transparent",
                color: "#e5e5e5",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#39BDF8",
                color: "#1a1a1a",
                fontSize: "13px",
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
