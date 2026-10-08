export type UserRole = 'USER' | 'ADMIN';

export interface AuthenticatedUser {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
}

export interface SessionResponse {
  readonly user: AuthenticatedUser;
  readonly expiresAt: string;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface LogoutResponse {
  readonly loggedOut: true;
}
