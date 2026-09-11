# New Dashboard (shipping-erp) — Gap Analysis vs Legacy + Client Requirements

## Project Status
- **Source**: /home/arash/shipping-dashboard/new-erp (copied from opencode workspace)
- **Stack**: Next.js 14 (App Router) + NestJS + Prisma + pnpm monorepo
- **Design System**: ui-ux-pro-max skill -> Minimalism & Swiss Style, tracking blue + delivery orange, Fira Code/Sans
- **Indexed**: codebase-memory-mcp project shipping-erp-new (4909 nodes, 14228 edges)

---

## Module Coverage: Client Requirements vs New Dashboard Nav

| Client Module | Nav Section | Nav Status | API Module | Prisma Model |
|---|---|---|---|---|
| **Operations** | | | | |
| Yard Inventory | Operations | implemented | yard-inventory | YardInventory |
| Load List | Operations | implemented | load-planning | LoadList, LoadListItem |
| Yard | Operations | implemented | yards | Yard |
| Port | Operations | implemented | ports | Port |
| **Manifest & B/L** | | | | |
| B/L | Operations | planned | — | — |
| Manifest | Operations | planned | — | — |
| Shipper | (in Cargo?) | ? | cargo | Cargo (has shipperId) |
| Agent | Commercial | planned | — | — |
| Consignee | (in Cargo?) | ? | cargo | Cargo (has consigneeId) |
| Vessel | Operations | implemented | vessels | Vessel |
| **Accounting** | | | | |
| Invoice | Commercial | planned | — | — |
| Receipt Voucher | (in Fin?) | planned | — | — |
| Payment Voucher | (in Fin?) | planned | — | — |
| Ledger | Insight & Control | planned | — | — |
| Delivery Order | Operations | planned | — | — |
| Release Order | Commercial | planned | — | — |
| Proforma | — | missing | — | — |
| Quotation | — | missing | — | — |
| Salary | — | missing | — | — |
| Financial Reports | Insight & Control | planned (Reports) | — | — |
| **Letters** | — | missing | — | — |
| **Customers** | Master Data | implemented | customers | Customer |
| **Users** | Access Control | implemented | users | User |

**Coverage**: 6/22 fully implemented, 8/22 planned, 8/22 missing entirely

---

## Technical Gaps (Priority Order)

### P0 — Critical Foundation
| Gap | Current | Needed | Effort |
|---|---|---|---|
| i18n (Persian + English + RTL) | None | next-intl with locale routing, RTL direction, Farsi fonts | Medium |
| RTL Support | LTR only | Tailwind RTL config, dir="rtl" on html, logical properties | Medium |
| Persian Font | Fira Sans (Latin) | Vazirmatn / IRANSans + fallback | Low |
| Jalali Date | Native JS Date | persian-tools or similar for شمسی dates | Low |

### P1 — Missing Domain Modules (Client Must-Haves)
| Module | Nav Status | API | Prisma | Notes |
|---|---|---|---|---|
| Manifest | planned | — | — | Core shipping doc |
| Bill of Lading | planned | — | — | Core shipping doc |
| Delivery Order | planned | — | — | Accounting flow |
| Release Order | planned | — | — | Accounting flow |
| Invoice | planned | — | — | Revenue |
| Receipt/Payment Voucher | planned | — | — | Fin tracking |
| Ledger | planned | — | — | Accounting |
| Financial Reports | planned | — | — | Management |
| Letters | missing | — | — | Communications |
| Proforma/Quotation | missing | — | — | Sales |
| Salary | missing | — | — | HR |
| Agents | planned | — | — | Commercial |

### P2 — UI/UX Polish (from ui-ux-pro-max skill)
| Gap | Skill Guidance |
|---|---|
| Density too low for data-dense ops | --density 8 (8-32px scale) |
| Motion too subtle for status changes | --motion 7 (standard stagger) |
| Variance balanced but could be bolder | --variance 8 (asymmetric grids) |
| Charts not implemented | --domain chart for real-time dashboards |
| Accessibility audit needed | --domain ux for each page |

### P3 — Agent/Automation Readiness
| Gap | Needed |
|---|---|
| API client typing | Already typed (@shipping/shared) |
| Event bus for agent triggers | NestJS CQRS or custom event emitter |
| Audit log for agent actions | Prisma model + interceptor |
| Webhook endpoints | For external integrations (port APIs, customs) |

---

## What New Dashboard Already Has (vs Legacy)
| Feature | New Dashboard | Legacy (duna) |
|---|---|---|
| Architecture | Monorepo, proper types, NestJS modules | Laravel monolith |
| Auth | JWT + Refresh tokens, RBAC | Custom level + Role/Permission |
| DB | Prisma, UUID, soft delete, Decimal(18,2) | Eloquent, auto-increment, no soft delete |
| API | REST /api/v1, pagination envelope | Blade-rendered only |
| Design System | Skill-derived (Minimalism) | AdminLTE template |
| Theme | Light/Dark HSL tokens | Hardcoded |
| Status enums | Explicit on each model | String constants |
| Numbering rules | Not yet | Helpers: generateManifestNumber, etc. |
| Multi-language | None | Persian only (hardcoded) |

---

## Recommended Build Order (Step-by-Step)

### Phase 0: Foundation (Week 1)
1. Copy + index done
2. **i18n + RTL + Persian fonts** <- **NEXT STEP**
3. Apply design-system output (colors, density, typography)
4. Persian date formatting (Jalali)

### Phase 1: Core Operations (Week 2-3)
5. Cargo (enhance with shipper/consignee/agent relations)
6. Load Lists -> connect to Cargo + Vessel
7. Actual Loading -> complete workflow
8. Yard Inventory + Yards + Ports (enhance)

### Phase 2: Manifest & B/L (Week 3-4)
9. Manifest module (CRUD + PDF generation)
10. Bill of Lading module (CRUD + PDF, attach Cargo)

### Phase 3: Accounting (Week 4-5)
11. Invoice + Items
12. Receipt/Payment Voucher (Fin)
13. Ledger
14. Proforma/Quotation
15. Release Order / Delivery Order

### Phase 4: Intelligence (Week 5-6)
16. Reports (Financial, Operational)
17. Letters (Correspondence)
18. Dashboard KPIs

### Phase 5: Agent Ready (Week 6-8)
19. Event bus + Audit log
20. Webhook endpoints
21. Agent skill definitions

---

## Files to Modify for i18n + RTL (Phase 0)

| File | Change |
|---|---|
| apps/web/package.json | Add next-intl |
| apps/web/src/middleware.ts | Locale detection + routing |
| apps/web/src/i18n/ (new) | routing.ts, request.ts, messages/en.json, messages/fa.json |
| apps/web/src/app/[locale]/ (new) | Locale-prefixed app router |
| apps/web/tailwind.config.ts | Add RTL plugin, logical properties |
| apps/web/src/app/globals.css | RTL logical properties, Persian font |
| apps/web/src/components/ui/* | Use cn() with logical properties |
| apps/web/src/lib/navigation/nav.ts | Use i18n for labels |
| All pages | Wrap with useTranslations() |

---

## How to Run Tests (After Each Step)
```bash
cd /home/arash/shipping-dashboard/new-erp
pnpm install              # if new deps added
pnpm dev                  # web:3000 + api:3001
pnpm typecheck            # tsc --noEmit
pnpm lint                 # eslint
pnpm build                # production build
# Manual: visit http://localhost:3000/fa (Persian) and /en (English)
```