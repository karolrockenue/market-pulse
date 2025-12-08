export interface UserInfo {
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
  status?: string;
  user_id?: string;
}

export interface TeamMember extends UserInfo {
  user_id: string;
  status: string;
  role: string;
}

export interface UserProfileResponse {
  first_name: string;
  last_name: string;
  email: string;
}

export interface InviteUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  propertyId: string;
}
