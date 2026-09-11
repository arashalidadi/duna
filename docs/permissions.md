# Permissions & RBAC Model

## Model (Phase 2 — implemented)

```
Permission (code, module, action)         — read-only seeded registry (ADR-016)
Role        (code, name, isSystem, deletedAt)
RolePermission  (roleId, permissionId) — composite PK
User        (email, passwordHash, isActive, lastLoginAt, passwordChangedAt)
UserRole        (userId, roleId) — composite PK
RefreshToken    (userId, tokenHash, lookupKey, expiresAt, revokedAt, replacedByTokenId)
```

Permission codes follow `module:action`. A role is **active** when `deletedAt IS NULL` (ADR-015).

## Seeded permissions (49)

| Module     | Permissions                          |
| ---------- | ------------------------------------ |
| dashboard  | `dashboard:read`                     |
| user       | `user:read`, `user:create`, `user:update`, `user:activate`, `user:roles` |
| role       | `role:read`, `role:create`, `role:update`, `role:activate`, `role:permissions` |
| permission | `permission:read`                    |
| port       | `port:read`, `port:create`, `port:update` |
| yard       | `yard:read`, `yard:create`, `yard:update` |
| customer   | `customer:read`, `customer:create`, `customer:update` |
| currency   | `currency:read`                      |
| cargo      | `cargo:read`, `cargo:create`, `cargo:update`, `cargo:transition`, `cargo:delete` |
| yard-inventory | `yard-inventory:read`, `yard-inventory:create`, `yard-inventory:update`, `yard-inventory:remove` |
| inspection | `inspection:read`, `inspection:create`, `inspection:update`, `inspection:approve`, `inspection:reject` |
| vessel     | `vessel:read`, `vessel:create`, `vessel:update`, `vessel:activate` |
| voyage     | `voyage:read`, `voyage:create`, `voyage:update`, `voyage:schedule`, `voyage:start`, `voyage:complete`, `voyage:cancel` |

Notes:

- **Cargo** adds a dedicated `cargo:transition` for lifecycle state changes (PATCH `/cargo/:id/status`) and
  `cargo:delete` for the guarded soft-delete. `cargo:update` covers business-field edits.
- **Yard Inventory** uses `yard-inventory:remove` (DELETE) distinct from `:update` (PATCH move/status),
  since removing a cargo from a yard is its own semantic operation that reverts cargo status.
- **Inspection** uses action verbs `:approve` / `:reject` (POST actions, each its own permission) alongside
  `:read` / `:create` / `:update` so approving/rejecting an inspection can be gated independently of
  editing its fields. This is the first module to exercise the extended action vocabulary.
- **Vessel** uses a dedicated `vessel:activate` (PATCH `/vessels/:id/active`) distinct from `vessel:update`
  (field edits) — deactivation is its own guarded lifecycle operation (unfinished-voyage guard).
- **Voyage** uses action verbs `:schedule` / `:start` / `:complete` / `:cancel` (POST operations, each its
  own permission) beside `:read` / `:create` / `:update`, so each state-machine transition can be gated
  independently (ADR-026).
- There are no `:delete` permissions on master data: reference data uses soft-delete routed through the
  `:update` permission (`update` → `deletedAt`).
- Delete-that-destroys is not offered — operational records and reference data are retained via
  status/soft-delete per the project conventions.

## Authorization flow (implemented)

1. Client logs in → `/auth/login` returns a short-lived JWT **access token**.
2. Every request with `Authorization: Bearer <jwt>` is validated by the global **`JwtAuthGuard`
   (secure-by-default)**. Any handler that should be public must opt out with `@Public()`.
3. The `JwtAuthGuard` resolves the user's effective permission codes and attaches them to the request.
4. The **`PermissionsGuard`** then reads `@RequirePermissions('module:action', ...)` from the handler and
   enforces them (AND by default; `@RequirePermissions(..., { match: 'OR' })` supported).
5. Permissions are **always re-loaded from the database per request** (`resolvePermissions`), so role or
   permission changes take effect immediately (ADR-014 tradeoff: one extra query per authenticated request).

Enforcement is always **server-side**. Frontend permission-aware rendering (`hasPermission`) is UX only;
it never replaces guard checks.

## Authorization flow (applied)

| Endpoint group                      | Required permission | Notes                                  |
| ----------------------------------- | ------------------- | -------------------------------------- |
| Auth (`/auth/login|refresh|logout|me`) | `@Public()`       | `/me` returns `{ user, permissions }`   |
| `GET /health`, `GET /api/v1`        | `@Public()`         | API metadata + health are anonymous     |
| Ports / yards / customers           | `port:read` etc.    | create/update gated separately; delete uses `:update`; lifecycle `PATCH /:id/active` also uses `:update` (ADR-018) |
| Currencies                          | `currency:read`     |                                    |
| `/users`                            | `user:*`            | list `user:read`; create `user:create`; roles `user:roles`; activate `user:activate`; password reset `user:update` |
| `/roles`                            | `role:*`            | `role:permissions` for permission binding |
| `/permissions`                      | `permission:read`   |                                    |
| `/cargo`                            | `cargo:*`           | list/get `cargo:read`; create `cargo:create`; edit `cargo:update`; status `cargo:transition`; delete `cargo:delete` |
| `/yard-inventory`                   | `yard-inventory:*`  | list/get `yard-inventory:read`; place `yard-inventory:create`; move/update `yard-inventory:update`; remove `yard-inventory:remove` |
| `/inspections`                      | `inspection:*`      | list/get/history `inspection:read`; create `inspection:create`; edit `inspection:update`; approve `inspection:approve`; reject `inspection:reject` |
| `/vessels`                          | `vessel:*`          | list/get `vessel:read`; create `vessel:create`; edit `vessel:update`; lifecyle active `vessel:activate`; delete routes through `vessel:update` |
| `/voyages`                          | `voyage:*`          | list/get `voyage:read`; create `voyage:create`; edit `voyage:update`; schedule `voyage:schedule`; start `voyage:start`; complete `voyage:complete`; cancel `voyage:cancel` |

## Roles (initial)

| Role        | Scope                                     | System?            |
| ----------- | ----------------------------------------- | ------------------ |
| ADMIN       | Full access (bind-all seed permissions)   | yes (cannot deactivate) |
| OPERATIONS  | Op module read + write, no finance        | no                 |

Future roles (FINANCE, ACCOUNTANT, AGENT, VIEWER) are plain create-via-UI roles bound to the seeded
permission vocabulary; `ADMIN` is fixed by seed.

## Permission & status semantics

- **401 Unauthenticated:** missing/invalid/expired `Bearer` token → correct where no principal exists.
- **403 Forbidden:** valid token but the required permission is not granted → correct where a principal
  exists but lacks access. Distinguishing is handled by `JwtAuthGuard` vs `PermissionsGuard`.
- **User activation:** `user:activate` grants the ability to enable/disable accounts; disabled users are
  rejected at login and their refresh tokens revoked.

## UI behaviour

- The sidebar filters navigation sections by `requiredPermission`.
- Buttons/actions use `hasPermission`/`hasAnyPermission` to show or hide; the same permission is enforced
  by the API regardless. Password hashes are never returned by the API nor rendered.