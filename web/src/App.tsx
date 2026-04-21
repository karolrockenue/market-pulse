import {
  useState,
  useMemo,
  useEffect,
  useRef,
  Component,
  lazy,
  Suspense,
  type ReactNode,
} from "react";

const LazyMasonDashboard = lazy(() =>
  import("./features/rockenue/components/MasonDashboard").then((m) => ({
    default: m.MasonDashboard,
  })),
);

import { TopNav } from "./components/TopNav";
import { AppSidebar } from "./components/AppSidebar";
import { AppTopBar } from "./components/AppTopBar";

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

import { CompetitiveData } from "./features/market-intel/components/CompetitiveData";
import { SentinelHub } from "./features/sentinel/SentinelHub";
import { RockenueHub } from "./features/rockenue/RockenueHub";
import { HotelRateWindow } from "./features/sentinel/components/HotelRateWindow/HotelRateWindow";

import { LandingPage } from "./components/LandingPage";
import { Deck } from "./components/Deck";
import { ShreejiDeck } from "./components/ShreejiDeck";
import { DeckV2 } from "./components/DeckV2";
import { MarketProfile } from "./components/MarketProfile";
import { MarketVeil } from "./components/MarketVeil";
import { ArchanesInvestorView } from "./features/market-intel/components/ArchanesInvestorView";
import { NoHotelConnected } from "./components/NoHotelConnected";
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

// Hotel record that backs the Archanes Investor View. Users whose only
// linked property is this hotel are restricted to the Investor View and
// shown a "no hotel connected" overlay everywhere else.
const ARCHANES_HOTEL_ID = 318330;

// Synthetic property ID for the Mason & Fifth multi-property dashboard.
// When the user picks this entry from the property dropdown we route to the
// Mason Dashboard view instead of changing the real selected hotel.
const MASON_DASHBOARD_PSEUDO_ID = "MASON_DASHBOARD";

// Real Mason & Fifth hotel IDs. Picking any of these routes the dashboard
// view to MasonDashboard (service breakdown + YoY) instead of the generic
// HotelDashboard.
const MASON_HOTEL_IDS = [318329, 318341, 318343];
function isMasonProperty(propertyStr: string): boolean {
  const n = parseInt(propertyStr, 10);
  return Number.isFinite(n) && MASON_HOTEL_IDS.includes(n);
}

export default function App() {
  // --- STATE DECLARATIONS ---

  // [NEW] Add a state to track the initial session check
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  // [MODIFIED] Default activeView to null while we check the session
  const [activeView, setActiveView] = useState<string | null>(null);
  // [NEW] Add state to remember the view before navigating to a legal page
  const [previousView, setPreviousView] = useState<string | null>(null);
  const [initialReport, setInitialReport] = useState<string | null>(null);

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

  // Mason Dashboard access — non-null once /api/mason/access resolves
  const [hasMasonAccess, setHasMasonAccess] = useState<boolean>(false);

  const [currencyCode, setCurrencyCode] = useState("USD");
  const [selectedPropertyDetails, setSelectedPropertyDetails] =
    useState<any>(null);
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [showGrantAccess, setShowGrantAccess] = useState(false);
  const [isGranting, setIsGranting] = useState(false); // <--- Added

  const [showPropertySetup, setShowPropertySetup] = useState(false); // [MODIFIED] Default to false
  const [marketHotelCount, setMarketHotelCount] = useState<number>(0);

  // Detect "Archanes-only" users: regular role + exactly one linked property
  // == the Archanes hotel. They're routed to the Investor View on load and
  // see a "no hotel connected" overlay anywhere else.
  const isArchanesOnly = useMemo(() => {
    if (!userInfo) return false;
    if (userInfo.role === "super_admin" || userInfo.role === "admin") return false;
    if (properties.length !== 1) return false;
    return properties[0].property_id === ARCHANES_HOTEL_ID;
  }, [userInfo, properties]);

  // Auto-route Archanes-only users to the Investor View. Runs whenever the
  // detection flips on or the active view changes underneath them.
  useEffect(() => {
    if (!isArchanesOnly) return;
    if (!activeView) return;
    // Allow legal pages, the landing page, and the investor view itself
    // to render naturally. Anything else gets bounced.
    const allowed = ["demand-pace", "landing", "privacy", "terms"];
    if (!allowed.includes(activeView)) {
      setActiveView("demand-pace");
      sessionStorage.setItem("marketPulseActiveView", "demand-pace");
    }
  }, [isArchanesOnly, activeView]);

  useEffect(() => {
    const fetchHotelDetails = async () => {
      // Don't run if the property ID (string) is empty
      // [FIX] Also skip if property is 'ALL' (Portfolio View)
      if (!property || property === "ALL" || property === MASON_DASHBOARD_PSEUDO_ID) {
        setSelectedPropertyDetails(null);
        return;
      }

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

        // Fetch market hotel count for veil logic (use raw count, not presentation multiplier)
        try {
          const mcRes = await fetch(`/api/metrics/market-context?propertyId=${property}`);
          if (mcRes.ok) {
            const mcData = await mcRes.json();
            setMarketHotelCount(mcData.rawMarketHotels ?? mcData.marketHotels ?? 0);
          }
        } catch { /* non-critical */ }
      } catch (error) {
        console.error("Error fetching hotel details:", error);
        setCurrencyCode("USD"); // Default on error
        setSelectedPropertyDetails(null); // Clear details on error
        setMarketHotelCount(0);
      }
    };

    fetchHotelDetails();
  }, [property]); // This hook runs whenever the selected 'property' changes.

  // Probe Mason Dashboard access. 200 → user qualifies; 403 → hide entry.
  useEffect(() => {
    fetch("/api/mason/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHasMasonAccess(!!d?.hasAccess))
      .catch(() => setHasMasonAccess(false));
  }, []);

  const isAdminUser =
    userInfo?.role === "super_admin" || userInfo?.role === "admin";

  // Inject the synthetic "Mason Dashboard" entry. Only admins get the
  // aggregated cross-property view; regular M&F users just pick individual
  // Mason hotels from their normal dropdown and get the scoped Mason view.
  const propertiesWithMason: Property[] = useMemo(() => {
    const withMason = (() => {
      if (!hasMasonAccess || !isAdminUser) return properties;
      if (properties.some((p) => String(p.property_id) === MASON_DASHBOARD_PSEUDO_ID)) {
        return properties;
      }
      return [
        ...properties,
        // Cast keeps TS happy — the sidebar treats property_id as a union of string|number
        { property_id: MASON_DASHBOARD_PSEUDO_ID as unknown as number, property_name: "Mason Dashboard" },
      ];
    })();
    // Pin Archanes Market Watch to the bottom of the property selector.
    const archanes = withMason.filter((p) => p.property_id === ARCHANES_HOTEL_ID);
    if (archanes.length === 0) return withMason;
    const rest = withMason.filter((p) => p.property_id !== ARCHANES_HOTEL_ID);
    return [...rest, ...archanes];
  }, [properties, hasMasonAccess, isAdminUser]);

  // When the user picks "Mason Dashboard" in the dropdown, route to the view.
  useEffect(() => {
    if (property === MASON_DASHBOARD_PSEUDO_ID && activeView !== "masonDashboard") {
      setActiveView("masonDashboard");
      sessionStorage.setItem("marketPulseActiveView", "masonDashboard");
    }
  }, [property, activeView]);

  // When the user navigates away from Mason Dashboard while the synthetic
  // property is still "selected", snap back to their first real property.
  useEffect(() => {
    if (
      activeView !== "masonDashboard" &&
      property === MASON_DASHBOARD_PSEUDO_ID
    ) {
      const firstReal = properties.find(
        (p) => typeof p.property_id === "number",
      );
      if (firstReal) setProperty(firstReal.property_id.toString());
    }
  }, [activeView, properties, property]);

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
          `/api/metrics/metadata/sync-status/${propertyId}`,
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

          // Force dashboard view (not whatever was in sessionStorage before redirect)
          setActiveView("dashboard");
          sessionStorage.setItem("marketPulseActiveView", "dashboard");
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
            `No active session found. Status: ${response.status}`,
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
          const urlView = new URLSearchParams(window.location.search).get("view");
          const lastView = sessionStorage.getItem("marketPulseActiveView");
          setActiveView(urlView || lastView || "dashboard");
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
        "Cannot save classification.",
      );
      return;
    }

    try {
      const res = await fetch('/api/hotels/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId: property, category: tier }),
      });
      if (!res.ok) throw new Error('Failed to save classification');
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

    // Support "reports:bookings-report" style deep-links
    if (newView.startsWith("reports:")) {
      setInitialReport(newView.split(":")[1]);
      newView = "reports";
    } else {
      setInitialReport(null);
    }

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
      <div className="min-h-screen bg-[#14181D] flex items-center justify-center">
        {/* Simple loader */}
        <div className="w-12 h-12 border-4 border-[#38C6BA] border-t-transparent border-solid rounded-full animate-spin"></div>
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
            previousView || (isSessionLoading ? "landing" : "dashboard"),
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
            previousView || (isSessionLoading ? "landing" : "dashboard"),
          )
        }
      />
    );
  }

  if (activeView === "deck") {
    return (
      <Deck onBack={() => setActiveView(previousView || "dashboard")} />
    );
  }

  if (activeView === "shreejiDeck") {
    return (
      <ShreejiDeck onBack={() => setActiveView(previousView || "dashboard")} />
    );
  }

  if (activeView === "deckV2") {
    return (
      <DeckV2 onBack={() => setActiveView(previousView || "dashboard")} />
    );
  }

  return (
    activeView && (
      // [MODIFIED] Wrap the entire app content with ActionListProvider (ErrorBoundary moved to main.tsx)
      // <ErrorBoundary>  <-- Removed
      <ActionListProvider>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            backgroundColor: "#14181D",
          }}
        >
          {isSyncing && <InitialSyncScreen />}

          <AppSidebar
            activeView={activeView}
            onViewChange={handleViewChange}
            property={property}
            onPropertyChange={setProperty}
            properties={propertiesWithMason}
            userInfo={userInfo}
            cityName={selectedPropertyDetails?.city}
            isArchanesOnly={isArchanesOnly}
          />

          <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
            <AppTopBar
              activeView={activeView}
              propertyName={
                property === "ALL"
                  ? "Portfolio"
                  : properties.find((p) => p.property_id.toString() === property)?.property_name ?? ""
              }
              hotelId={property === "ALL" ? null : parseInt(property, 10) || null}
              userRole={userInfo?.role}
              userEmail={userInfo?.email}
              onNavigate={(view: string) => {
                const singlePropertyViews = [
                  "reports", "settings", "hotelRates", "sentinel",
                  "riskOverview", "rateManager",
                  "competitive-intel", "demandRadar",
                ];
                if (property === "ALL" && singlePropertyViews.includes(view) && properties.length > 0) {
                  setProperty(properties[0].property_id.toString());
                }
                handleViewChange(view);
              }}
              isArchanesOnly={isArchanesOnly}
            />
          {/* Landing View block is now removed and handled above */}

          {/* Archanes-only users get a "no hotel connected" overlay anywhere
              other than the Investor View itself. The auto-route effect
              normally preempts this, but the wrap covers the brief gap
              between activeView change and the next render. */}
          {isArchanesOnly && activeView !== "demand-pace" ? (
            <NoHotelConnected onBackToInvestor={() => setActiveView("demand-pace")} />
          ) : (
          <>
          {activeView === "dashboard" &&
            (isMasonProperty(property) ? (
              <Suspense fallback={null}>
                <LazyMasonDashboard scopedHotelId={parseInt(property, 10)} />
              </Suspense>
            ) : (
              <DashboardHub
                propertyId={
                  property === "ALL"
                    ? "ALL"
                    : selectedPropertyDetails?.hotel_id || null
                }
                city={selectedPropertyDetails?.city}
                onNavigate={handleViewChange}
              />
            ))}
          {activeView === "reports" && (
            <ReportsHub
              key={initialReport || "hub"}
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
              initialReport={initialReport}
            />
          )}
          {activeView === "admin" && <AdminHub />}
          {activeView === "marketProfile" && <MarketProfile />}
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
                  className="bg-[#38C6BA] text-[#1a1a1a] px-6 py-3 rounded hover:bg-[#e8ef5a]"
                >
                  Open Property Setup Modal
                </button>
              </div>
            </div>
          )}

          {/* [NEW] Render the Demand & Pace page */}
          {activeView === "demand-pace" &&
            (selectedPropertyDetails ? (
              selectedPropertyDetails.city === "archanes" ? (
                <ArchanesInvestorView
                  citySlug="archanes"
                  currencySymbol={
                    currencyCode === "GBP"
                      ? "£"
                      : currencyCode === "USD"
                        ? "$"
                        : "€"
                  }
                />
              ) : marketHotelCount < 5 ? (
                <MarketVeil
                  cityName={selectedPropertyDetails.city}
                  currentCount={marketHotelCount}
                />
              ) : (
                <DemandPace
                  propertyId={selectedPropertyDetails.hotel_id}
                  currencyCode={currencyCode}
                  citySlug={selectedPropertyDetails.city}
                />
              )
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
                  background: "#1a1a1a", // [UPDATED] Matches main background color
                  color: "#e5e5e5",
                  padding: "24px",
                }}
              >
                <div className="w-8 h-8 border-4 border-[#38C6BA] border-t-transparent border-solid rounded-full animate-spin mb-4"></div>
                <h2 className="text-xl font-light text-[#e5e5e5]">
                  Loading Market Context...
                </h2>
                <p className="text-[#6b7280] text-sm mt-2">
                  Syncing city demand and room inventory...
                </p>
              </div>
            ))}

          {activeView === "competitive-intel" && (
            marketHotelCount < 5 && selectedPropertyDetails?.city !== "archanes" ? (
              <MarketVeil
                cityName={selectedPropertyDetails?.city}
                currentCount={marketHotelCount}
              />
            ) : (
              <CompetitiveData
                propertyId={property}
                currencySymbol={
                  currencyCode === "GBP"
                    ? "£"
                    : currencyCode === "EUR"
                      ? "€"
                      : "$"
                }
                hotelCategory={selectedPropertyDetails?.category || null}
                properties={properties}
                onPropertyChange={setProperty}
                onNavigate={handleViewChange}

              />
            )
          )}

          {activeView === "hotelRates" && (
            <HotelRateWindow allHotels={properties} userHotels={properties} />
          )}

          {/* Sentinel Domain Hub */}
          {(activeView === "sentinel" ||
            activeView === "rateManager" ||
            activeView === "riskOverview" ||
            activeView === "demandRadar" ||
            activeView === "sentinelHealth") && (
            <SentinelHub
              activeView={activeView}
              onNavigate={handleViewChange}
              selectedProperty={selectedPropertyDetails}
            />
          )}

          {/* Rockenue Domain Hub */}
          {(activeView === "rockenueDashboard" ||
            activeView === "distribution" ||
            activeView === "crm" ||
            activeView === "channelPricing" ||
            activeView === "emailSignatures" ||
            activeView === "canvas" ||
            activeView === "mpReportsHub" ||
            activeView === "mpDemandRadar" ||
            activeView === "mpRiskOverview" ||
            activeView === "mpLogin" ||
            activeView === "masonDashboard" ||
            activeView === "reportsLab" ||
            activeView === "topnavPills") && (
            <RockenueHub
              activeView={activeView}
              onNavigate={handleViewChange}
              userName={userInfo?.firstName || "User"}
            />
          )}
          </>
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
            expand={true}
            position="top-right"
            closeButton
            toastOptions={{
              style: { zIndex: 9999 },
            }}
          />
          </div>{/* end content column */}
        </div>{/* end flex container */}
      </ActionListProvider>
      // </ErrorBoundary> <-- Removed
    ) // [NEW] This closes the conditional render from `activeView && (`
  );
}
