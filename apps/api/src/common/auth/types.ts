/**
 * The authenticated principal attached to a request after JWT validation.
 * Permissions are always loaded server-side (never trusted from the client).
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: { id: string; code: string }[];
  permissions: string[];
  /** Portal links are carried from the freshly loaded user row for office-output isolation. */
  portalAgentId?: string | null;
  portalCustomerId?: string | null;
  /**
   * DEC-116 — true for the single primary administrator (the company owner).
   *
   * The primary administrator holds full system authority. That authority is
   * IMPLICIT: it is not derived from role membership or permission rows, so it
   * cannot be lost through permission misconfiguration, and `permissions` above
   * is NOT the source of truth for them.
   *
   * Audit records actions; it never gates the primary administrator and never
   * creates an approval hierarchy above them.
   */
  isPrimaryAdmin: boolean;
}

/**
 * The permission code that grants the technical ability to approve a release
 * exception where payment is incomplete.
 *
 * DEC-116: possession of this permission is NECESSARY BUT NOT SUFFICIENT for a
 * manager to exercise release authority — it must have been granted explicitly
 * by the primary administrator (enforced server-side in RolesService and
 * UsersService). The primary administrator is exempt, by implicit full authority.
 */
export const RELEASE_OVERRIDE_PERMISSION = 'release:override';

/**
 * Semantics for how multiple required permissions are evaluated by
 * PermissionsGuard. 'AND' requires all; 'OR' requires at least one.
 */
export type PermissionMatch = 'AND' | 'OR';

export interface RequiredPermissions {
  permissions: string[];
  match: PermissionMatch;
}