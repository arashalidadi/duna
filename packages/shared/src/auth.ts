/**
 * Authentication & authorization contract types shared between the API and the
 * web client. These mirror the /auth, /users, /roles and /permissions endpoints.
 */

export interface AuthUserRole {
  id: string;
  code: string;
  name: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  roles: AuthUserRole[];
}

export interface LoginResponse {
  user: CurrentUser;
  permissions: string[];
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: AuthUserRole[];
}

export interface UserDetail extends UserListItem {
  passwordChangedAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
}

export interface RolePermissionItem {
  id: string;
  code: string;
  module: string;
  action: string;
}

export interface RoleListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  permissions: RolePermissionItem[];
}

export interface PermissionListItem {
  id: string;
  code: string;
  module: string;
  action: string;
}

export interface UserRef {
  id: string;
  email: string;
  fullName: string;
}