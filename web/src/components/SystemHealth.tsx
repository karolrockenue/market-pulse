import { Button } from './ui/button';
import { useState } from 'react';
import { Database, Cloud, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

// Define the props our component now accepts
interface SystemHealthProps {
  propertyId: string; // The ID from the shared admin dropdown
  lastRefreshTime: string | null;
  onRefreshData: () => void; // Function to call after a successful refresh
}

export function SystemHealth({ propertyId, lastRefreshTime, onRefreshData }: SystemHealthProps) {
  // Local state for tracking the status of tests
  const [dbStatus, setDbStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
  const [cloudbedsStatus, setCloudbedsStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Tests the database connection by calling the backend endpoint.
   */
  const testDatabase = async () => {
    setDbStatus('testing');
    try {
      // Call the endpoint from admin.router.js
      const response = await fetch('/api/admin/test-database');
      if (!response.ok) throw new Error('Database test failed');
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Database test failed');
      
      setDbStatus('connected');
      toast.success('Database connection successful.');
    } catch (error: any) {
      setDbStatus('error');
      toast.error(error.message);
    }
  };

  /**
   * Tests the Cloudbeds API connection using the selected propertyId.
   */
  const testCloudbeds = async () => {
    setCloudbedsStatus('testing');
    
    // Check if a propertyId was provided
    if (!propertyId) {
      setCloudbedsStatus('error');
      toast.error('Test failed: No API Target Property selected.');
      return;
    }

    try {
      // Call the endpoint, passing the propertyId
      const response = await fetch(`/api/admin/test-cloudbeds?propertyId=${propertyId}`);
      const data = await response.json(); // Read JSON body even on error
      
      if (!response.ok || !data.success) {
        // If the user selected a Mews property, this test *should* fail.
        if (data.error && data.error.includes('Could not find a valid refresh token')) {
          throw new Error('Auth test failed (Hint: Is a Mews property selected?)');
        }
        throw new Error(data.error || 'Cloudbeds test failed');
      }

      setCloudbedsStatus('connected');
      toast.success('Cloudbeds authentication successful.');
    } catch (error: any) {
      setCloudbedsStatus('error');
      toast.error(error.message);
    }
  };

  /**
   * Triggers the daily data refresh cron job.
   */
  const forceRefresh = async () => {
    setIsRefreshing(true);
    const toastId = toast.loading('Forcing daily data refresh...');
    try {
      // Call the endpoint from admin.router.js
      const response = await fetch('/api/admin/daily-refresh');
      if (!response.ok) throw new Error('Refresh job failed to start');
      const data = await response.json(); // Vercel cron jobs return JSON
      if (data.error) throw new Error(data.error);

      toast.success('Daily refresh job triggered.', { id: toastId });
      // Call the onRefreshData prop to update the time in App.tsx
      onRefreshData(); 
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper component to render status icons
  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'testing':
        return <Loader2 className="w-4 h-4 text-[#faff6a] animate-spin" />;
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-[#10b981]" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-[#ef4444]" />;
      default:
        // 'idle'
        return <div className="w-4 h-4 rounded-full bg-[#3a3a35]" />;
    }
  };

  return (
    <div className="bg-[#262626] rounded border border-[#3a3a35] p-5">
      <h2 className="text-[#e5e5e5] text-lg mb-4">System Status & Health</h2>
      
      {/* Back to a 3-column grid, as Mews test is not in the original */}
      <div className="grid grid-cols-3 gap-4">
        {/* Database Test */}
        <div className="bg-[#1f1f1c] rounded p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-[#9ca3af]" />
            <span className="text-[#e5e5e5] text-sm">Database</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <StatusIcon status={dbStatus} />
            <span className="text-[#9ca3af] text-xs">
              {dbStatus === 'idle' && 'Not tested'}
              {dbStatus === 'testing' && 'Testing...'}
              {dbStatus === 'connected' && 'Connected'}
              {dbStatus === 'error' && 'Connection failed'}
            </span>
          </div>
          <Button
            onClick={testDatabase}
            disabled={dbStatus === 'testing'}
            className="w-full h-8 bg-[#262626] border border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] text-xs"
          >
            Test Database
          </Button>
        </div>

        {/* Cloudbeds Auth Test */}
        <div className="bg-[#1f1f1c] rounded p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cloud className="w-4 h-4 text-[#9ca3af]" />
            <span className="text-[#e5e5e5] text-sm">Cloudbeds Auth</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <StatusIcon status={cloudbedsStatus} />
            <span className="text-[#9ca3af] text-xs">
              {cloudbedsStatus === 'idle' && 'Not tested'}
              {cloudbedsStatus === 'testing' && 'Testing...'}
              {cloudbedsStatus === 'connected' && 'Authenticated'}
      {cloudbedsStatus === 'error' && 'Auth failed'}
            </span>
          </div>
          <Button
            onClick={testCloudbeds}
            disabled={cloudbedsStatus === 'testing'}
            className="w-full h-8 bg-[#262626] border border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] text-xs"
          >
            Test Auth
          </Button>
        </div>

        {/* Data Freshness */}
        <div className="bg-[#1f1f1c] rounded p-4">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-4 h-4 text-[#9ca3af]" />
            <span className="text-[#e5e5e5] text-sm">Data Freshness</span>
          </div>
          <div className="mb-3">
            <div className="text-[#9ca3af] text-xs mb-1">Last Daily Refresh</div>
            {/* Use the lastRefreshTime prop, formatted to a time string */}
            <div className="text-[#faff6a] text-xs">
              {lastRefreshTime ? new Date(lastRefreshTime).toLocaleString() : 'Never'}
            </div>
          </div>
          <Button
            onClick={forceRefresh}
            disabled={isRefreshing}
            className="w-full h-8 bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a] text-xs"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Refreshing...
              </>
            ) : (
              'Force Refresh'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}