import { UserInfo, TeamMember, UserProfileResponse, InviteUserPayload } from './types';

export const settingsApi = {
  // Get current user profile
  getProfile: async (): Promise<UserProfileResponse> => {
    const res = await fetch('/api/users/profile');
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  },

  // Update current user profile
  updateProfile: async (firstName: string, lastName: string): Promise<UserProfileResponse> => {
    const res = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName }),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  },

  // Get Team Members
  getTeamMembers: async (propertyId: string): Promise<TeamMember[]> => {
    if (!propertyId) return [];
    const res = await fetch(`/api/users/team?propertyId=${propertyId}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        }
    });
    if (!res.ok) throw new Error('Failed to fetch team members');
    return res.json();
  },

  // Invite User
  inviteUser: async (payload: InviteUserPayload): Promise<{ message: string }> => {
    const res = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invitee_email: payload.email,
        invitee_first_name: payload.firstName,
        invitee_last_name: payload.lastName,
        property_id: payload.propertyId,
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to send invitation');
    return result;
  },

  // Remove User (Placeholder API based on App.tsx)
  removeUser: async (userId: string): Promise<void> => {
    return Promise.resolve();
  },

  // Soft disconnect a hotel (preserves data)
  disconnectHotel: async (hotelId: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`/api/hotels/${hotelId}/disconnect`, { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error('Failed to disconnect hotel');
    return res.json();
  },

  // Reconnect a soft-disconnected hotel
  reconnectHotel: async (hotelId: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`/api/hotels/${hotelId}/reconnect`, { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error('Failed to reconnect hotel');
    return res.json();
  },
};