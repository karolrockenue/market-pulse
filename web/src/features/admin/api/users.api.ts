export interface AdminUser {
  user_id: number;
  cloudbeds_user_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  can_view_rates: boolean;
  property_count: number;
}

export const usersApi = {
  getAll: async (): Promise<AdminUser[]> => {
    const res = await fetch('/api/users/all');
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  setRatesAccess: async (
    userId: number,
    canViewRates: boolean
  ): Promise<{ user_id: number; can_view_rates: boolean }> => {
    const res = await fetch(`/api/users/${userId}/rates-access`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ can_view_rates: canViewRates }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update rate access');
    }
    return res.json();
  },
};
