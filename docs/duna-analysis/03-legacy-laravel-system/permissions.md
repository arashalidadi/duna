# Legacy Laravel — Permissions

> The legacy permission set, the two-tier access model, and how it compares with the current system.

---

## 1. Two-tier model

| Tier | Check | Scope |
|---|---|---|
| **Tier** | `AdminMiddleware` → `level == 'Admin'` | All `/admin/*` |
| **Tier** | `UserMiddleware` → `level == 'User'` | All `/profile/*` |
| **Permission** | `@can('…')` in Blade | Individual buttons / menu items |

**Key finding:** the permission layer is **decorative**. It hides buttons; it does not protect
endpoints. A `level='Admin'` user with an empty permission set still passes every middleware check
and can still call any route directly by URL.

```php
class AdminMiddleware {
    public function handle($request, Closure $next) {
        if (Auth::user()->level == 'Admin') return $next($request);
        else abort(403);
    }
}
```

---

## 2. Permission catalogue

Grouped by module. (Names taken verbatim from the `@can` guards in the Blade views.)

### Cargo / Loading
```
loadings.show
loadings.new
loadings.edit
loadings.delete
loadings.yards
loadings.ports
loadings.adminapprove
loadinglist.show
```

### Manifest / B/L
```
manifest.show
manifest.create
manifest.shipper
manifest.agents.show
manifest.consignee.show
manifest.report
bl.new
bl.delete
release.manager
```

### Accounting
```
invoice.show
invoice.create
invoice.edit
invoice.delete
invoice.payment
ledger.show
ledger.payment
ledger.reciept
ledger.edit
ledger.delete
```

### Pre-sales
```
offer.show
quotation.show
performa.show
```

### Users & access
```
user.index
user.create
users.newcustomer
permission.index
role.index
setting.general
```

---

## 3. Observations

| # | Observation |
|---|---|
| P1 | **No `view` / `edit` split on manifests.** A single `manifest.show` gates listing, preview and view; there is no `manifest.edit` or `manifest.delete` permission |
| P2 | **`bl.edit` does not exist.** `bl.new` and `bl.delete` do; editing a B/L is therefore ungated |
| P3 | **`loadings.adminapprove` is a legacy-only permission** for the management-review gate the employer never asked for |
| P4 | **Payment and receipt are separate permissions** (`ledger.payment`, `ledger.reciept`) — a useful distinction worth preserving |
| P5 | **Invoice payment status is its own permission** (`invoice.payment`), separate from editing the invoice |
| P6 | **`release.manager` exists but gates a screen with no release action** (defect **D1**) |
| P7 | **Permissions are seeded, not migrated.** Only 4 stock migrations exist; the permission and role rows must have been created by a seeder or by hand |
| P8 | **Deleting a role reassigns users to role id 8** — hard-coded (defect **D10**) |
| P9 | **The customer portal has no permission layer at all**, only the `level='User'` tier check |

---

## 4. Comparison with the current system

The current system has **105 permissions across 12 resources** with a `roleGranularPermissions`
feature flag and full server-side enforcement.

| | Legacy | Current |
|---|---|---|
| Where enforced | Blade `@can` (UI only) | Server-side guards |
| Granularity | ~35 permissions, unevenly distributed | 105 permissions, 12 resources |
| Resources | Ad hoc | `users`, `roles`, `permissions`, `bl`, `manifest`, `invoice`, `vesselVoyage`, `cargo`, `job`, `loadingList`, `ledger`, `settings` |
| Customer / agent portal | Tier check only | Dedicated portal with scoping |
| Feature flags | None | `roleGranularPermissions`, `enableAutomation`, plus more |
| Audit of permission changes | None | Audit log |

**Worth preserving from the legacy set:** the payment/receipt split (P4) and the
invoice-payment-status-as-its-own-permission pattern (P5).

**Not worth preserving:** `loadings.adminapprove` (P3) — a legacy-only gate.

---

## 5. Employer's ask

The employer's requirements mention access control only in passing: *"Admin panel and access
control"* under Section 1, general requirements (`REQ-001`–`REQ-003`). No specific roles or
permissions were named beyond the existence of roles.

The current system's 105-permission model is therefore a **design decision made by the current
project**, not an employer requirement — see
[`../05-current-project/`](../05-current-project/) and `docs/permissions.md`.
