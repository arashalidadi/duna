/**
 * The authenticated principal attached to a request after JWT validation.
 * Permissions are always loaded server-side (never trusted from the client).
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: { id: string; code: string }[];
  permissions: string[];
}

/**
 * Semantics for how multiple required permissions are evaluated by
 * PermissionsGuard. 'AND' requires all; 'OR' requires at least one.
 */
export type PermissionMatch = 'AND' | 'OR';

export interface RequiredPermissions {
  permissions: string[];
  match: PermissionMatch;
}