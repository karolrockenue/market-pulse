import { Input } from './ui/input';
import { Button } from './ui/button';
import { useState } from 'react';
import { Plug, Loader2, CheckCircle } from 'lucide-react';
// Import toast
import { toast } from 'sonner@2.0.3';

// Define the shape of the report object from the API
interface Report {
  report_id: string;
  report_name: string;
  property_name: string;
}

// Define the props for the component
interface ManualReportTriggerProps {
  reports: Report[]; // Accept the list of reports
}

// Accept the reports prop
export function MewsOnboarding() { // Changed function name back to MewsOnboarding
  const [accessToken, setAccessToken] = useState('');
  const [email, setEmail] = useState('');
  // Add state for first and last name
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Simplify status for button state
  const [status, setStatus] = useState<'idle' | 'connecting'>('idle');

  const handleConnect = async () => {
    setStatus('connecting'); // Disable button
    const toastId = toast.loading('Validating details with Mews...');

    try {
      // --- Step 1: Validate ---
      const validateResponse = await fetch('/api/auth/mews/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, accessToken }),
      });

      const validateResult = await validateResponse.json();

      if (!validateResponse.ok) {
        // Handle validation errors (e.g., user exists, invalid token)
        throw new Error(validateResult.message || 'Validation failed');
      }

      // --- Step 2: Check Token Type & Create ---
      if (validateResult.tokenType === 'single') {
        toast.loading('Validation successful. Creating connection...', { id: toastId });

        const createResponse = await fetch('/api/auth/mews/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            accessToken,
            // Pass the single property returned by the validate endpoint
            selectedProperties: validateResult.properties,
          }),
        });

        const createResult = await createResponse.json();

        if (!createResponse.ok) {
          throw new Error(createResult.message || 'Failed to create connection');
        }

        // --- Step 3: Success & Redirect ---
        toast.success(createResult.message || 'Connection successful! Redirecting...', { id: toastId, duration: 4000 });

        // Redirect the user after a short delay
        setTimeout(() => {
          if (createResult.redirectTo) {
            window.location.href = createResult.redirectTo; //
          } else {
            // Fallback if redirect URL is missing
            window.location.href = '/app/';
          }
        }, 1500);
        // Keep button disabled during redirect phase

      } else if (validateResult.tokenType === 'portfolio') { //
        // Handle portfolio tokens - show error for this component
        throw new Error('Portfolio tokens are not supported in this form. Please use a single property token.');
      } else {
        // Handle unexpected token types
        throw new Error('Received an unknown token type from the server.');
      }

    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
      setStatus('idle'); // Re-enable button on error
    }
    // No 'finally' block needed here, button stays disabled on success until redirect
  };

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-5">
      <h2 className="text-[#e5e5e5] text-lg mb-4">Mews Property Onboarding</h2>

      {/* Changed to 4 columns to fit all fields */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {/* First Name Input */}
        <div>
          <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
            Owner's First Name
          </label>
          <Input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jane"
            className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
          />
        </div>

        {/* Last Name Input */}
        <div>
          <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
            Owner's Last Name
          </label>
          <Input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Doe"
            className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
          />
        </div>

        {/* Email Input */}
        <div>
          <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
            Owner's Email Address
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@property.com"
            className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
          />
        </div>

        {/* Access Token Input */}
        <div>
          <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
            Mews Access Token
          </label>
          <Input
            type="password" // Changed type to password
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Enter Mews API access token..."
            className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]"
          />
        </div>
      </div>

      <Button
        onClick={handleConnect}
        // Updated disabled condition
        disabled={!firstName || !lastName || !accessToken || !email || status === 'connecting'}
        className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a] h-10 px-6"
      >
        {status === 'connecting' ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : ( // Removed 'success' state from button text as redirect happens quickly
          <>
            <Plug className="w-4 h-4 mr-2" />
            Connect & Sync Property
          </>
        )}
      </Button>
      {/* Removed the old inline message display div */}
    </div>
  );
}