import { useDashboardData } from "./hooks/useDashboardData";
import { HotelDashboard } from "./components/HotelDashboard";
import { PortfolioOverview } from "./components/PortfolioOverview";

interface DashboardHubProps {
  propertyId: number | string | null;
  city: string | undefined;
  onNavigate: (view: string, hotelId?: number) => void;
}

// Isolate single-hotel logic to respect Rule of Hooks (conditional rendering)
function SingleHotelView({
  propertyId,
  city,
  onNavigate,
}: {
  propertyId: number;
  city: string | undefined;
  onNavigate: (view: string) => void;
}) {
  const { data, isLoading } = useDashboardData(propertyId, city);
  return (
    <HotelDashboard onNavigate={onNavigate} data={data} isLoading={isLoading} />
  );
}

export default function DashboardHub({
  propertyId,
  city,
  onNavigate,
}: DashboardHubProps) {
  if (propertyId === "ALL") {
    return <PortfolioOverview onNavigate={onNavigate} />;
  }

  const numericId =
    typeof propertyId === "string" ? parseInt(propertyId, 10) : propertyId;

  if (!numericId || isNaN(numericId)) return null;

  return (
    <SingleHotelView
      propertyId={numericId}
      city={city}
      onNavigate={onNavigate}
    />
  );
}
