import { AuthenticatedUser } from './types';

/**
 * The acting user's identity and server-loaded capabilities, injected from the
 * verified token + fresh DB lookup. Used by services for audit/resource checks.
 */
export type AccountAccess = AuthenticatedUser;