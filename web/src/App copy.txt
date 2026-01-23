import {
  useState,
  useMemo,
  useEffect,
  useRef,
  Component,
  type ReactNode,
} from "react";

// [NEW] Error Boundary to auto-fix "Gray Screen" / ChunkLoadErrors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    // If the error is a "ChunkLoadError" (version mismatch), reload immediately
    if (
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("Importing a module script failed")
    ) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1a1a18] flex flex-col items-center justify-center p-4">
          <h2 className="text-[#e5e5e5] text-xl mb-4">Something went wrong</h2>
          <p className="text-[#9ca3af] mb-6">
            We just updated the system. Please reload.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-[#faff6a] text-black font-medium rounded hover:bg-[#e8ef5a] transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { TopNav } from "./components/TopNav";

import { DemandPace } from "./components/DemandPace";

import { ReportsHub } from "./features/reports/ReportsHub";
// [REMOVED] Legacy report components (ReportControls, ReportTable, etc.) replaced by ReportsHub
import AdminHub from "./features/admin/AdminHub";
import { SettingsPage } from "./components/SettingsPage";

import { InviteUserModal } from "./components/InviteUserModal";
import { GrantAccessModal } from "./components/GrantAccessModal";

import { InitialSyncScreen } from "./components/InitialSyncScreen";
// [REMOVED] Old setup modal
// [NEW] Import the new classification modal and its type
import {
  PropertyClassificationModal,
  type PropertyTier,
} from "./components/PropertyClassificationModal";

import { SentinelHub } from "./features/sentinel/SentinelHub";

import { LandingPage } from "./components/LandingPage";
// [NEW] Import the legal page components
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { SupportPage } from "./components/SupportPage"; // [NEW] Import the new support page
import { TermsOfService } from "./components/TermsOfService";

// Import both the function `toast` and the component `Toaster`
// [FIX] Removed the invalid '@2.0.3' version from the import path
import { toast } from "sonner";
import { sentinelToast } from "./components/ui/sentinel-toast";
// [NEW] Import the local Toaster component from the correct 'ui' folder
import { Toaster } from "./components/ui/sonner";

import DashboardHub from "./features/dashboard/DashboardHub"; // [NEW] Use the Feature Hub
import { ActionListProvider } from "./components/ActionListContext"; // [NEW] Import the provider

// --- TYPE DEFINITIONS ---
interface Property {
  property_id: number;
  property_name: string;
}

export default function App() {
  // --- STATE DECLARATIONS ---

  // [NEW] Add a state to track the initial session check
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  // [MODIFIED] Default activeView to null while we check the session
  const [activeView, setActiveView] = useState<string | null>(null);
  // [NEW] Add state to remember the view before navigating to a legal page
  const [previousView, setPreviousView] = useState<string | null>(null);

  // [MODIFIED] Add the user's role to the userInfo state object
  const [userInfo, setUserInfo] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null>(null);

  // [NEW] Add state to store the team members for the Settings page
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // [NEW] State to show the sync screen, mirroring dashboard.mjs 'isSyncing'
  const [isSyncing, setIsSyncing] = useState(false);

  // New state to store the 'last updated' timestamp from the API
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  // Data State
  const [properties, setProperties] = useState<Property[]>([]);
  const [property, setProperty] = useState("");

  const [currencyCode, setCurrencyCode] = useState("USD");
  const [selectedPropertyDetails, setSelectedPropertyDetails] =
    useState<any>(null);
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [showGrantAccess, setShowGrantAccess] = useState(false);
  const [isGranting, setIsGranting] = useState(false); // <--- Added

  const [showPropertySetup, setShowPropertySetup] = useState(false); // [MODIFIED] Default to false

  useEffect(() => {
    const fetchHotelDetails = async () => {
      // Don't run if the property ID (string) is empty
      if (!property) return;

      try {
        const response = await fetch(`/api/hotels/${property}/details`);
        if (!response.ok) throw new Error("Failed to fetch hotel details");

        const data = await response.json();
        setSelectedPropertyDetails(data);

        console.log("App.tsx: Fetched and set selectedPropertyDetails:", data);
        // --- END DEBUG LOGGING ---

        // Also set the currency code from the same data
        if (data.currency_code) {
          setCurrencyCode(data.currency_code);
        } else {
          setCurrencyCode("USD"); // Default
        }
      } catch (error) {
        console.error("Error fetching hotel details:", error);
        setCurrencyCode("USD"); // Default on error
        setSelectedPropertyDetails(null); // Clear details on error
      }
    };

    fetchHotelDetails();
  }, [property]); // This hook runs whenever the selected 'property' changes.

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch("/api/hotels/mine");
        if (!response.ok) throw new Error("Failed to fetch properties");
        const data: Property[] = await response.json();
        setProperties(data);

        // Check the URL for a propertyId parameter.
        const urlParams = new URLSearchParams(window.location.search);
        const propertyIdFromUrl = urlParams.get("propertyId");

        // If a valid propertyId is in the URL, use it. Otherwise, default to the first property.
        if (
          propertyIdFromUrl &&
          data.some((p) => p.property_id.toString() === propertyIdFromUrl)
        ) {
          setProperty(propertyIdFromUrl);
        } else if (data.length > 0) {
          setProperty(data[0].property_id.toString());
        }
      } catch (error) {
        console.error("Error fetching properties:", error);
      }
    };
    fetchProperties();
  }, []);

  // Effect to update the URL whenever the selected property changes.
  useEffect(() => {
    // Do not modify the URL if the property hasn't been set yet.
    if (!property) return;

    const url = new URL(window.location.href);
    url.searchParams.set("propertyId", property);
    // Update the URL in the browser's address bar without a page reload.
    window.history.pushState({}, "", url);
  }, [property]); // This effect runs only when the 'property' state changes.

  // [NEW] Effect to handle the initial sync process, mirroring dashboard.mjs
  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    // This effect runs once when the app is loaded and the session is confirmed.
    // It checks for the `newConnection=true` URL parameter.
    const urlParams = new URLSearchParams(window.location.search);
    const propertyId = urlParams.get("propertyId");
    const isNewConnection = urlParams.get("newConnection") === "true";

    // If it's not a new connection, do nothing.
    if (!isNewConnection || !propertyId) {
      return;
    }

    // [NEW] It's a new connection, so show the overlay and start polling.
    setIsSyncing(true); //
    let pollingInterval: number | null = null;

    const checkSyncStatus = async () => {
      try {
        // [NEW] Call the sync status endpoint
        const response = await fetch(
          `/api/metrics/metadata/sync-status/${propertyId}`
        );
        if (!response.ok) {
          throw new Error("Sync check failed");
        }
        const data = await response.json();
        // [NEW] If the API says sync is complete, stop polling and hide overlay.
        //
        if (data.isSyncComplete === true) {
          setIsSyncing(false); // Hide the sync screen
          if (pollingInterval) clearInterval(pollingInterval); // Stop polling

          setShowPropertySetup(true);

          const url = new URL(window.location.href);
          url.searchParams.delete("newConnection");
          window.history.replaceState({}, "", url);
        }
        // If false, the poll continues, and the `isSyncing` overlay remains.
      } catch (error) {
        console.error("Error checking sync status:", error);
        setIsSyncing(false); // Default to not syncing on error
        if (pollingInterval) clearInterval(pollingInterval);
      }
    };

    // [NEW] Start the polling interval, matching the 15-second timer
    // from the original application.
    pollingInterval = window.setInterval(checkSyncStatus, 15000);

    // [NEW] Run the check immediately on load
    checkSyncStatus();

    // [NEW] The cleanup function for this useEffect
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
    // [FIX] This hook should *only* run once when the session is loaded (when isSessionLoading flips to false).
    // It should NOT run every time activeView changes.
  }, [isSessionLoading]); // This hook now runs only when the session loading state changes.

  // Reusable function to fetch the last data refresh time
  // This is now defined in the main component scope
  // Reusable function to fetch the last data refresh time
  // This is now defined in the main component scope
  const fetchLastRefreshTime = async () => {
    try {
      // Call the existing endpoint
      const response = await fetch("/api/metrics/metadata/last-refresh");
      if (!response.ok) throw new Error("Failed to fetch last refresh time");
      const data = await response.json();

      // The endpoint returns a full timestamp, e.g., "2025-10-18T05:30:00.000Z"
      if (data.last_successful_run) {
        setLastUpdatedAt(data.last_successful_run);
      }
    } catch (error) {
      console.error("Error fetching last refresh time:", error);
      setLastUpdatedAt(null); // Set to null on error
    }
  };

  // Effect to fetch the last data refresh time, runs once on load.
  useEffect(() => {
    fetchLastRefreshTime(); // Call the function
  }, []); // Empty dependency array ensures this runs only once.

  // App.tsx
  // [NEW] This effect hook fetches the user's editable profile info (first/last name)
  // [NEW] Function to fetch the list of team members (hoisted)
  const fetchTeamMembers = async () => {
    // [THE FIX] Don't fetch if property isn't set yet
    if (!property) return;

    try {
      const response = await fetch(`/api/users/team?propertyId=${property}`, {
        credentials: "include",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch team members");
      const teamData = await response.json();
      setTeamMembers(teamData);
    } catch (error: any) {
      console.error("Error fetching team members:", error);
      toast.error("Could not load team members", {
        description: error.message,
      });
      setTeamMembers([]);
    }
  };

  // [MODIFIED] This effect hook now fetches data needed for the Settings page
  useEffect(() => {
    // Function to fetch the user's editable profile
    // Function to fetch the user's editable profile
    const fetchUserProfile = async () => {
      try {
        const response = await fetch("/api/users/profile");
        if (!response.ok) throw new Error("Failed to fetch profile");
        const profileData = await response.json();

        setUserInfo((prev) => ({
          ...prev!,
          firstName: profileData.first_name || "",
          lastName: profileData.last_name || "",
          email: profileData.email || "",
        }));
      } catch (error) {
        console.error("Error fetching user profile:", error);
        toast.error("Could not load user profile.");
      }
    };

    // [MODIFIED] Only run these fetches if the settings view is active
    if (activeView === "settings") {
      // Fetch profile only if we don't have it
      if (!userInfo || userInfo.email === "email@placeholder.com") {
        fetchUserProfile();
      }
      // Always fetch the latest team list
      fetchTeamMembers();
    }
  }, [activeView, userInfo, property]); // 'fetchTeamMembers' is stable, but 'property' is the key dependency

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const response = await fetch("/api/auth/session-info", {
          credentials: "include",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });

        if (!response.ok) {
          throw new Error(
            `No active session found. Status: ${response.status}`
          );
        }

        const session = await response.json();

        if (session.isLoggedIn) {
          setUserInfo({
            firstName: session.firstName || "User",
            lastName: session.lastName || "",
            email: session.email || "email@placeholder.com",
            role: session.role || "user",
          });
          const lastView = sessionStorage.getItem("marketPulseActiveView");
          setActiveView(lastView || "dashboard");
        } else {
          setActiveView("landing");
        }
      } catch (error) {
        console.error("Error checking user session:", error);
        setActiveView("landing");
      } finally {
        setIsSessionLoading(false);
      }
    };

    checkUserSession();
  }, []);

  const handlePropertySetupComplete = async (tier: PropertyTier) => {
    if (!property) {
      sentinelToast.error(
        "No property selected",
        "Cannot save classification."
      );
      return;
    }

    try {
      // TODO: when backend endpoint is ready, call it here
      // await fetch('/api/admin/save-property-tier', { ... })
    } catch (error: any) {
      console.error("Error saving property classification:", error);
      sentinelToast.error("Error saving classification", error.message);
      return;
    }

    sentinelToast.success(`Property classified as ${tier}`);
    setShowPropertySetup(false);
    window.location.reload();
  };

  // --- HANDLER FUNCTIONS ---
  // [NEW] This function handles all view changes and tracks the previous view
  const handleViewChange = (newView: string) => {
    // [FIX] Scroll to the top of the page on every view change
    window.scrollTo(0, 0);

    // If we are navigating TO a legal page, store the current view
    if (newView === "privacy" || newView === "terms") {
      setPreviousView(activeView);
    }
    // Set the new view
    setActiveView(newView);

    // [NEW] Persist the active view in session storage to survive refreshes
    // We don't persist legal/support pages, only main app views
    if (newView !== "privacy" && newView !== "terms" && newView !== "support") {
      sessionStorage.setItem("marketPulseActiveView", newView);
    }
  };

  // [NEW] Handler for sending a user invitation
  const handleSendInvite = async (data: {
    email: string;
    firstName: string;
    lastName: string;
    propertyId: string;
  }) => {
    setIsInviting(true); // Start loading
    try {
      const response = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitee_email: data.email,
          invitee_first_name: data.firstName,
          invitee_last_name: data.lastName,
          property_id: data.propertyId,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to send invitation");
      }

      toast.success(result.message || "Invitation sent successfully!");
      setShowInviteUser(false); // Close the modal on success

      // [THE FIX] Refresh the team list to show the new pending user
      // We must call the function that fetches team members.
      // Based on your code, that logic is inside this useEffect hook (lines 740-771)
      // Let's create a dedicated function for it.

      // (See Step 2a below - we need to refactor fetchTeamMembers)
      fetchTeamMembers();
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      toast.error("Error sending invitation", { description: error.message });
    } finally {
      setIsInviting(false); // Stop loading
    }
  };
  // [NEW] Function to handle saving the user's profile
  // [NEW] Function to handle saving the user's profile
  const handleUpdateProfile = async (firstName: string, lastName: string) => {
    try {
      const response = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update profile");
      }

      // Update the local state to match
      setUserInfo((prev) => ({
        ...prev!,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
      }));

      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Error updating profile", { description: error.message });
    }
  };
  // [FIX] This function is now refactored to call the "correct" endpoints,

  // REPLACE
  // [NEW] Handler for granting access to an existing user
  const handleGrantAccess = async (data: {
    email: string;
    propertyId: string;
  }) => {
    setIsGranting(true);
    try {
      const response = await fetch("/api/users/link-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          propertyId: data.propertyId,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to grant access");
      }

      toast.success(result.message || "Access granted successfully!");
      setShowGrantAccess(false);

      // Refresh team list to show the new member immediately
      fetchTeamMembers();
    } catch (error: any) {
      console.error("Error granting access:", error);
      toast.error("Error granting access", { description: error.message });
    } finally {
      setIsGranting(false);
    }
  };

  const handleRemoveUser = (userId: string) => {
    toast.success("User removed from team");
  };
  // [REMOVED] Admin handlers moved to features/admin/hooks/useAdminData.ts

  // [NEW] Show a full-screen loader while checking the session
  if (isSessionLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a18] flex items-center justify-center">
        {/* Simple loader */}
        <div className="w-12 h-12 border-4 border-[#faff6a] border-t-transparent border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  // [NEW] If the view is 'landing', render *only* the LandingPage component.
  // This fulfills the requirement of not showing the TopNav.
  if (activeView === "landing") {
    return (
      <LandingPage
        onSignIn={() => setActiveView("dashboard")}
        // [NEW] Pass the view change handler to the LandingPage for its footer links
        onViewChange={handleViewChange}
      />
    );
  }

  // [NEW] Handle legal pages as full-screen overlays
  if (activeView === "privacy") {
    return (
      <PrivacyPolicy
        // Go back to 'dashboard' if logged in, or 'landing' if logged out
        onBack={() =>
          setActiveView(
            previousView || (isSessionLoading ? "landing" : "dashboard")
          )
        }
      />
    );
  }

  if (activeView === "terms") {
    return (
      <TermsOfService
        // Go back to 'dashboard' if logged in, or 'landing' if logged out
        onBack={() =>
          setActiveView(
            previousView || (isSessionLoading ? "landing" : "dashboard")
          )
        }
      />
    );
  }

  return (
    activeView && (
      // [MODIFIED] Wrap the entire app content with ErrorBoundary and ActionListProvider
      <ErrorBoundary>
        <ActionListProvider>
          <div
            className="min-h-screen"
            style={
              activeView === "reports"
                ? {
                    backgroundImage:
                      "linear-gradient(180deg, #111111 0%, #050507 60%, #000000 100%), radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
                    backgroundSize: "100% 100%, 4px 4px",
                    backgroundAttachment: "fixed",
                    backgroundColor: "#050507",
                  }
                : { backgroundColor: "#232320" }
            }
          >
            {/* [NEW] Conditionally render the InitialSyncScreen as a full-screen overlay
        based on the new `isSyncing` state, which mimics the original app. 
        */}
            {isSyncing && <InitialSyncScreen />}

            <TopNav
              activeView={activeView}
              // [MODIFIED] Pass our new, smarter handler to the TopNav
              onViewChange={handleViewChange}
              property={property}
              onPropertyChange={setProperty}
              properties={properties}
              // Pass the new state variable down to the TopNav component
              lastUpdatedAt={lastUpdatedAt}
              // [NEW] Pass the user info down to the TopNav
              userInfo={userInfo}
            />
            {/* Landing View block is now removed and handled above */}

            {activeView === "dashboard" && (
              <DashboardHub
                propertyId={selectedPropertyDetails?.hotel_id || null}
                city={selectedPropertyDetails?.city}
                onNavigate={handleViewChange}
              />
            )}
            {activeView === "reports" && (
              <ReportsHub
                hotelId={property}
                currencySymbol={
                  currencyCode === "GBP"
                    ? "£"
                    : currencyCode === "EUR"
                    ? "€"
                    : "$"
                }
                currencyCode={currencyCode}
                userRole={userInfo?.role}
              />
            )}
            {activeView === "admin" && <AdminHub />}
            {activeView === "settings" && (
              <SettingsPage
                hotelId={property}
                userRole={userInfo?.role}
                onInviteUser={() => setShowInviteUser(true)} // <--- Re-connected
                onGrantAccess={() => setShowGrantAccess(true)} // <--- Re-connected
              />
            )}

            {/* [NEW] Added the Support Page to the main app layout */}
            {activeView === "support" && (
              <SupportPage
                // Use the state-driven 'onBack' logic to return to the previous view
                onBack={() => setActiveView(previousView || "dashboard")}
              />
            )}

            {activeView === "setup" && (
              <div className="p-6">
                <div className="mb-6 text-center">
                  <h1 className="text-white text-2xl mb-2">
                    Property Setup Demo
                  </h1>
                  <p className="text-[#9ca3af] text-sm">
                    Click the button below to open the setup modal
                  </p>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowPropertySetup(true)}
                    className="bg-[#faff6a] text-[#1f1f1c] px-6 py-3 rounded hover:bg-[#e8ef5a]"
                  >
                    Open Property Setup Modal
                  </button>
                </div>
              </div>
            )}

            {/* [NEW] Render the Demand & Pace page */}
            {activeView === "demand-pace" &&
              // [FIX] Add a conditional check.
              // We must wait until 'selectedPropertyDetails' (which includes city and total_rooms)
              // has been fetched before we can render the component that depends on it.
              (selectedPropertyDetails ? (
                <DemandPace
                  // We can now safely use 'selectedPropertyDetails' for ALL props,
                  // as we know it's not null.
                  propertyId={selectedPropertyDetails.hotel_id}
                  // Pass the currencyCode we already have in state
                  currencyCode={currencyCode}
                  // Pass the 'city' string from our details object
                  citySlug={selectedPropertyDetails.city}
                />
              ) : (
                // [NEW] Render a simple loader while we wait for the property details to load.
                // This covers the brief moment between selecting a property and the API returning its details.
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "80vh",
                    background: "#1d1d1c", // [UPDATED] Matches main background color
                    color: "#e5e5e5",
                    padding: "24px",
                  }}
                >
                  <div className="w-8 h-8 border-4 border-[#39BDF8] border-t-transparent border-solid rounded-full animate-spin mb-4"></div>
                  <h2 className="text-xl font-light text-[#e5e5e5]">
                    Loading Market Context...
                  </h2>
                  <p className="text-[#6b7280] text-sm mt-2">
                    Syncing city demand and room inventory...
                  </p>
                </div>
              ))}

            {/* Sentinel Domain Hub */}
            {(activeView === "sentinel" ||
              activeView === "rateManager" ||
              activeView === "shadowfax" ||
              activeView === "propertyHub" ||
              activeView === "riskOverview") && (
              <SentinelHub
                activeView={activeView}
                onNavigate={handleViewChange}
              />
            )}

            {/* ManageCompSetModal moved to AdminHub */}
            <InviteUserModal
              open={showInviteUser}
              onClose={() => setShowInviteUser(false)}
              properties={properties}
              onSendInvite={handleSendInvite}
              isLoading={isInviting}
            />
            <GrantAccessModal
              open={showGrantAccess}
              onClose={() => setShowGrantAccess(false)}
              properties={properties}
              onGrantAccess={handleGrantAccess} // <--- Wired logic
              isLoading={isGranting} // <--- Wired loading state
            />
            <PropertyClassificationModal
              isOpen={showPropertySetup} // [MODIFIED] Prop renamed
              onClose={() => setShowPropertySetup(false)} // [NEW] Wire up onClose
              onComplete={handlePropertySetupComplete} // [NEW] Use the new handler
            />

            {/* Add the Toaster component here. It's invisible but necessary for toasts to appear. */}
            {/* We add theme="dark" to match the application's style. */}
            {/* [MODIFIED] Removed the 'richColors' prop to use the neutral styles from components/ui/sonner.tsx */}

            <Toaster
              theme="dark"
              expand={true} // <--- THIS FIXES THE OVERLAP (stacks them vertically)
              position="top-right" // Right side is usually better for vertical stacking
              closeButton
              toastOptions={{
                style: { zIndex: 9999 },
              }}
            />
          </div>
        </ActionListProvider>
      </ErrorBoundary>
    ) // [NEW] This closes the conditional render from `activeView && (`
  );
}
