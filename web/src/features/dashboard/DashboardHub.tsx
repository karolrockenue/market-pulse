import { useDashboardData } from './hooks/useDashboardData';
import { HotelDashboard } from './components/HotelDashboard';

interface DashboardHubProps {
  propertyId: number | null;
  city: string | undefined;
  onNavigate: (view: string) => void;
}

export default function DashboardHub({ propertyId, city, onNavigate }: DashboardHubProps) {
  // The hook handles all data fetching and state management
  const { data, isLoading } = useDashboardData(propertyId, city);

  // The view component is purely presentational
  return (
    <HotelDashboard 
      onNavigate={onNavigate}
      data={data}
      isLoading={isLoading}
    />
  );
}