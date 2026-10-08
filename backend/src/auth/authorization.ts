import type { AuthenticatedUser, UserRole } from '@hwsd/shared';

import { ApplicationError } from '../errors.js';

export function requireRole(user: AuthenticatedUser, role: UserRole): void {
  if (role === 'USER') return;
  if (user.role !== role) {
    throw new ApplicationError(403, 'AUTH_FORBIDDEN', 'You are not authorized for this action.');
  }
}

export function requireUser(user: AuthenticatedUser | null): asserts user is AuthenticatedUser {
  if (!user) throw new ApplicationError(401, 'AUTH_REQUIRED', 'Authentication is required.');
}

export function requireAdmin(user: AuthenticatedUser): void {
  requireRole(user, 'ADMIN');
}

export function requireOwner(user: AuthenticatedUser, ownerUserId: string | null): void {
  if (!ownerUserId || ownerUserId !== user.userId) {
    throw new ApplicationError(404, 'RESOURCE_NOT_FOUND', 'The requested resource is unavailable.');
  }
}
