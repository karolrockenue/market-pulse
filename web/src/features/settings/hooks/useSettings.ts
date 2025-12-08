import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { settingsApi } from "../api/settings.api";
import { TeamMember } from "../api/types";

export function useSettings(propertyId: string) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const fetchTeamMembers = useCallback(async () => {
    // [DEBUG] Check if ID exists
    console.log("useSettings: Fetching team for propertyId:", propertyId);

    if (!propertyId) {
      console.warn("useSettings: propertyId is missing, skipping fetch.");
      return;
    }

    setIsLoadingTeam(true);
    try {
      const members = await settingsApi.getTeamMembers(propertyId);
      // [DEBUG] Check raw response
      console.log("useSettings: API Response:", members);
      setTeamMembers(members);
    } catch (error: any) {
      console.error("Error fetching team:", error);
      toast.error("Could not load team members", {
        description: error.message,
      });
    } finally {
      setIsLoadingTeam(false);
    }
  }, [propertyId]);

  // Fetch on mount or property change
  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const handleSendInvite = async (data: {
    email: string;
    firstName: string;
    lastName: string;
    propertyId: string;
  }) => {
    setIsInviting(true);
    try {
      const result = await settingsApi.inviteUser(data);
      toast.success(result.message || "Invitation sent successfully!");

      // Refresh team list
      fetchTeamMembers();
      return true;
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      toast.error("Error sending invitation", { description: error.message });
      return false;
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      await settingsApi.removeUser(userId);
      toast.success("User removed from team");
      // Optimistic update
      setTeamMembers((prev) => prev.filter((u) => u.user_id !== userId));
    } catch (error) {
      // Error handled by api or toast
    }
  };

  return {
    teamMembers,
    isLoadingTeam,
    isInviting,
    handleSendInvite,
    handleRemoveUser,
    refreshTeam: fetchTeamMembers,
  };
}
