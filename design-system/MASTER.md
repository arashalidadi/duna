# MASTER.md — Shipping ERP Design System (Source of Truth)

> **Mandatory reading for all frontend work.** Any future phase that builds UI MUST read this file
> first, then check `design-system/pages/<page>.md` for page-specific overrides. Page overrides take
> precedence over this Master. Do not introduce an unrelated visual system.
>
> Generated and reasoned with the `ui-ux-pro-max` and `design-system` OpenCode skills (Project
> "Shipping ERP", Enterprise Operations, Minimalism / Swiss style, **operational tracking-blue
> primary**, density 8/10, motion 2/10, variance 3/10). Implemented in Phase 1.75 — this file
> describes the **current real UI**.

---

## 0. Design Principles

The UI must behave like a serious operational ERP used daily by shipping, yard, documentation,
finance, operations and management teams — not a marketing site.

1. **Clarity over decoration.** Every pixel justifies itself. Restraint is a feature.
2. **Speed.** Operators need scan-and-act. High information density, predictable placement.
3. **Accuracy.** Financial, numeric and date data must be unambiguous, aligned and consistent.
4. **Consistency.** One token system, one component set, one interaction script for the whole product.
5. **Professional + maritime.** Calm navy anchor, cool neutrals, restrained accent. Never cartoonish.
6. **Density with dignity.** Dense layouts that remain readable; never clutter.
7. **Accessibility is design.** Contrast, keyboard, focus, reduced motion are non-negotiable.
8. **Never fabricate data.** Screens show live data only. Skeleton/placeholder states must be clearly
   loading or empty — never fake metrics.

Visual language keywords: professional · trustworthy · operational · maritime · enterprise ·
financial · precise · modern · restrained.

Avoid: neon gradients, glassmorphism-as-style, decorative 3D, oversized marketing type, gratuitous
animation, shadow-heavy cards, over-rounded corners, clutter.

---

## 1. Brand / Product Identity

**Identity:** "Operational maritime precision." The system is the working bridge of a Dubai/UAE
shipping company — manifests, load lists, B/Ls, jobs, invoices, P&L.

- The **anchoring brand colour is operational tracking-blue** (`--primary`, blue-600 `#2563EB`) —
  a real-time, control-room primary that reads "systems online" at a glance. Calm cool-neutral
  background; strong high-contrast status set (success/warning/danger/info) — status is **never**
  conveyed by colour alone (badge text is always present).
- A **single restrained signal** is reserved for interactive focus and live status emphasises.
- **No nautical clutter.** No anchors in every header, no waves, no ship illustrations. The product
  mark (a line-style `Ship` glyph in a blue tile) is the only decorative maritime cue; domain icons
  (`Container`, `Anchor`, `Truck`, …) are functional navigation and status aids.
- Product name in UI: **Shipping ERP** / full "Shipping Operations & Accounting ERP" (from
  `@shipping/shared` `APP_NAME`).

---

## 2. Color System

Implementation: HSL CSS custom properties on `:root` (and `.dark`), mapped into Tailwind via
`tailwind.config.ts` as `hsl(var(--token))`. Three token layers (design-system skill):

```
Primitive layer   →  raw hues used nowhere directly
Semantic layer    →  --background, --primary, --success, ...  (used by utilities)
Component layer   →  component class strings (btn, badge variants) that reference semantic tokens
```

### 2.1 Core semantic tokens (light)

| Token                                        | Value (HSL)   | Purpose                                      |
| -------------------------------------------- | ------------- | -------------------------------------------- |
| `--background`                               | `220 14% 96%` | page canvas (cool neutral)                   |
| `--foreground`                               | `222 20% 13%` | default text                                 |
| `--card` / `--popover`                       | `0 0% 100%`   | elevated surfaces                            |
| `--card-foreground` / `--popover-foreground` | `222 20% 13%` | text on surfaces                             |
| `--primary`                                  | `217 91% 55%` | operational tracking-blue (blue-600 #2563EB) |
| `--primary-hover`                            | `217 91% 47%` | hover/depressed primary                      |
| `--primary-foreground`                       | `0 0% 100%`   | text on primary                              |
| `--secondary`                                | `220 14% 94%` | subtle button/surface fills                  |
| `--muted`                                    | `218 18% 92%` | neutral fills (inputs)                       |
| `--muted-foreground`                         | `215 16% 42%` | secondary text, captions                     |
| `--accent`                                   | `217 24% 93%` | hover surfaces, active nav                   |
| `--accent-foreground`                        | `222 20% 13%` | text on accent                               |
| `--destructive`                              | `0 72% 51%`   | errors, destructive actions                  |
| `--success`                                  | `152 55% 34%` | operational / connected / good               |
| `--warning`                                  | `35 92% 40%`  | attention / on-hold / overdue                |
| `--info`                                     | `199 84% 40%` | pending / informational                      |
| `--border` / `--input`                       | `216 16% 84%` | hairlines, input borders                     |
| `--ring`                                     | `217 91% 55%` | keyboard focus ring (primary)                |

Dark mode variants: background `222 18% 8%`, foreground `210 20% 96%`, surfaces `222 16% 11%`,
primary `217 91% 62%`, borders `218 16% 20%`, status colours lightened ~10pt BUT with dark
`*-foreground` values for amber/success/info to preserve WCAG AA on solid fills.

### 2.2 Operational status → colour mapping

Status is NEVER conveyed by colour alone. Every state shown as a **Badge/StatusBadge with text label**;
colour reinforces. Dot optional; text always present.

| Status                                                                 | Badge variant          | Meaning            |
| ---------------------------------------------------------------------- | ---------------------- | ------------------ |
| Active · Approved · Completed · Loaded · Released · Paid · Operational | `success`              | proceeding / good  |
| Draft · Inactive · Not Loaded · Cancelled · Discharged · Settled       | `neutral` or `outline` | resting state      |
| Pending · In Review · Issued · Partially Paid · In Progress           | `info`                 | in progress        |
| On Hold · Overdue · Discrepancy                                        | `warning`              | attention required |
| Rejected · Failed · Cancelled-by-error · Problem                       | `danger`               | blocked / negative |

Follow the same lexical scheme for all future lifecycle labels (e.g. `Draft → In Review → Approved`).
Where the same status is used in tables, filters, workflow steppers and documents, the SAME variant
token is used everywhere.

### 2.3 Contrast & use rules

- Body text ≥ 4.5:1 on its surface; large/non-text ≥ 3:1. Verify state colours in both modes.
- Filled primary buttons: white on tracking-blue. Tinted badges: `bg-<status>/12 text-<status> border-<status>/25`.
- Never use pure black text/content on saturated backgrounds; never put mid-tone status colours on
  mid-tone backgrounds.

---

## 3. Typography

Typeface: **Inter** (loaded via `next/font/google` as `--font-sans`, variable weights 400–700).
Rationale: enterprise-grade sans designed for screens, excellent tabular support, calm at dense
sizes; latin + extended coverage. **Arabic/multilingual:** add an Arabic companion font
(`--font-arabic`) when Phase adds RTL/Arabic — do not restyle; layout uses logical properties.

| Role                    | Spec                                         | Token location                                   |
| ----------------------- | -------------------------------------------- | ------------------------------------------------ |
| Page title              | `text-lg font-semibold tracking-tight`       | page header                                      |
| Section/card title      | `text-sm font-semibold`                      | CardTitle                                        |
| Body                    | `text-sm text-foreground`                    | default                                          |
| List/item text          | `text-sm`                                    | tables/forms                                     |
| Secondary/muted text    | `text-sm text-muted-foreground`              | captions, helper                                 |
| Label                   | `text-xs font-medium`                        | form labels, table headers (uppercase in tables) |
| Helper / hint / micro   | `text-xs text-muted-foreground`              | below inputs                                     |
| Table cell              | `text-[13px] leading-4`                      | dense tables                                     |
| **Numeric / financial** | `text-[13px] tabular-nums` **right-aligned** | amounts, qty, dates in tables                    |
| Code / reference        | `font-mono text-xs`                          | refs, ids, B/L no, container no, manifest no     |

Universal rules:

- All numbers in data tables use `tabular-nums` (add utilities in `globals.css`).
- IDs/reference numbers (`code`, B/L no, container no) render `font-mono text-xs`.
- No `font-bold` (600 is max weight used). No letterspacing tricks except `uppercase tracking-wide`
  on 10–11px table/section headers.
- Line-height: 1.5 body, 1.25 headings, dense tables use `leading-4`.

---

## 4. Spacing

4/8 rhythm scale (Tailwind rem units). Do not invent off-scale spacing.

| Token      | Value | Typical use                         |
| ---------- | ----- | ----------------------------------- |
| `space-1`  | 4px   | dense gaps, icon gaps               |
| `space-2`  | 8px   | component internal gaps             |
| `space-3`  | 12px  | control gaps, list rows             |
| `space-4`  | 16px  | default page/card padding           |
| `space-5`  | 20px  | section gaps, card header padding   |
| `space-6`  | 24px  | page section spacing                |
| `space-8`  | 32px  | page-level block spacing            |
| `space-10` | 40px  | hero-ish blocks, large empty states |

- Card padding: **16px (px-4 py-4)**, card header **16px**, dialog **16px**, drawer **16px**.
- Table row density: Default row `h-10`; dense `h-8` (use dense for operational lists); cell padding
  `px-3 py-1.5` (default) / `px-2 py-1` (dense).
- Grid gutters: 16px (mobile) → 24–32px (desktop) between cards/panels.

---

## 5. Border Radius & Elevation

| Token          | Radius | Use                                         |
| -------------- | ------ | ------------------------------------------- |
| `rounded-sm`   | 4px    | dense chips, skeleton bars                  |
| `rounded-md`   | 6px    | **buttons, inputs, selects, cells**         |
| `rounded-lg`   | 8px    | cards, dialogs, drawers, empty/error states |
| `rounded-full` | 999px  | badges, dots, avatars                       |

Elevation (Tailwind `shadow-*` only):

- Cards: `shadow-sm` (hairline + 1px). No lifted "floating" cards.
- Modal / drawer: `shadow-lg` + scrim `bg-black/50`.
- Menus/popovers: `shadow-md` + `ring-1 ring-border`.
- Never `shadow-xl/2xl` in normal screens.

---

## 6. Application Shell

- **Sidebar** (desktop `w-60`): `bg-card border-r`, brand tile (tracking-blue `bg-primary`, `Ship`
  icon), nav groups with 10px uppercase section headers (`micro-label`), rows `h-8` 13px text, active
  row `bg-primary/10 text-primary font-medium` + left indicator bar (`left-0 w-1 bg-primary`),
  hover `bg-accent`. "Planned/Soon" entries disabled with `neutral`/`outline` badge — never ghosting
  or fake destinations. Footer separated by border contains a **live system status block** (polled
  from `GET /api/v1/health`: green "System Operational" / red "Issue", with "checked HH:MM") and a
  static user block ("Administrator").
- **Topbar** (`h-14`): `bg-card border-b`, workspace label (micro-label + "Foundation" value) left,
  global search input left (disabled until Phase with search), action icons (notification with
  `bg-destructive` dot) + separator + user identity (avatar chip `bg-primary` "A", name "Administrator",
  "Active" status with `bg-success` dot) right. Icon-only buttons with visible `aria-label`.
- **Mobile:** sidebar becomes a left **Sheet (`w-72`)**; topbar menu button reveals it. Escape closes.
- **Breadcrumbs:** primary location under page header. `Home` icon + chevrons, current crumb
  `font-medium text-foreground`.
- **Page header pattern:** Breadcrumbs → title (`text-lg`) + 1-line description → actions (right).
- **Content container:** full-width; consistent padding `px-4 lg:px-6`, vertical rhythm `space-y-6`.
- Scalability: modules render from `lib/navigation/nav.ts` registry; adding a Phase module = add nav
  entry with icon + status; no shell code change.

---

## 7. Data Tables (operational core)

Standards for all future tables (Load Lists, Manifest, Cargo, Jobs, Ledger, …):

- **Density:** default `h-10` rows; `h-8` dense variant for operational lists. Never below `h-8`.
- **Alignment:** numbers, amounts, qty, dates → **right-aligned + `tabular-nums`**; text/ids left;
  booleans/status centered where a dot+label is shown.
- **Headers:** 10–11px uppercase `text-muted-foreground font-medium`, sticky (`sticky top-0 z-10 bg-card`)
  inside a bounded-height scroll container with `scrollbar-thin`.
- **Status:** `<Badge>` inside a dedicated Status column; the label text is the source of truth.
- **Row actions:** kebab/ellipsis menu for 3+ actions; primary action inline as `ghost` icon button.
- **Bulk actions:** checkbox column (only when actions exist); toolbar appears above table with count.
- **Sorting:** clickable sortable headers — indicate direction; server-driven per API `?sort=`/`?order=`.
- **Filtering:** use the Filter bar (section 8); never bury filters behind gestures.
- **Horizontal overflow:** wrap in `overflow-x-auto` rather than shrinking columns. Sticky first column
  only when the table is genuinely wide (ledger, import/export grids).
- **Pagination:** footer row, `muted` text — `Page X of Y · N items`, prev/next controls; `pageSize`
  select for operational grids.
- **Empty:** `EmptyState` (icon, title, description, optional action) — never a bare blank panel.
- **Loading:** `TableSkeleton` rows stable at the same height as the target table (no layout jump).
- **Error:** `ErrorState` with retry; inline banner where partial data still renders.
- Zebra striping is optional (`even:bg-muted/30`); prefer hairline `border-b` only for clean Windows
  office feel — recommended over zebra.

---

## 8. Search & Filtering

- **Global search:** topbar, Phase-gated. Keyboard shortcut later.
- **Page-level search:** input (left) + "Search" button + reset.
- **Filter bar:** consistent row pattern — field groups with labels, `date range` pickers, `status`
  multi-select, trailing **"Reset filters"** ghost button; returns a **count** of active filters.
- **Filter chips:** active filters render as removable chips (`Badge` + `X`) so users can delete one
  filter without resetting all. Chips are `role="button"`/button with aria-label "Remove filter X".
- **Saved filters:** deferred until a Phase has persistent user config.
- Responsive: filter bar collapses into a `Sheet` with a "Filters" button on mobile — never wraps
  into unusable rows.

---

## 9. Forms

- Label: `text-xs font-medium` above the field. Required: `*` + `aria-required`.
- Helper text: below field (`text-xs text-muted-foreground`). Error: below field, `text-destructive`
  - `role="alert"`; the field gets `border-destructive/50 focus-visible:ring-destructive/40`.
- Controls: `h-9 rounded-md border-input bg-card`, `focus-visible:ring-2 ring-ring`. Disabled:
  `bg-muted text-muted-foreground` + not focusable. Read-only: normal appearance, no focus ring.
- Number/currency inputs: right-align value, `tabular-nums`, currency symbol/ISO as prefix (small);
  decimal scale 2 for money, typed state kept in plain number in the domain layer (format at edges).
- Combobox/multi-select: combobox pattern (input + listbox) — Phase library decisions when modules land
  (prefer composing primitives over new deps; request approval before adding a select library).
- File upload: dropzone-style bordered card, `EmptyState`-like, with acceptance summary.
- Submit patterns: primary button right of the form footer; Cancel = outline/ghost; destructive
  confirmed (section 10). Never disable submit just because values are pristine (allow re-submit);
  disable only while a request is in flight.

---

## 10. Dialogs & Drawers

- **Confirmation** → `ConfirmDialog` (`max-w-md`); destructive variant confirms with a
  `destructive` button. Close on Escape, scrim click, cancel.
- **Small forms / quick capture** → `Dialog` (`max-w-lg`); large adds/details → **full-page** or
  **drawer** (`w-[min(560px,100vw)]` right). Never put large workflows in tiny dialogs.
- **Drawers** for contextual detail/edit without losing the list context; footer has sticky actions.
- All surfaces: `shadow-lg`, scrim `bg-black/50`, `rounded-lg`, Escape to close, focus moved into the
  panel (see accessibility), `aria-labelledby` referencing the title, body scroll locked while open.
- Destructive actions require a confirm dialog naming exactly what will be affected.

---

## 11. Status & Workflow Visualization

Use one consistent `Badge` variant scheme everywhere a state is shown (section 2.2).

Workflow sketches that must be reused for labels & colours:

- **Cargo:** Draft(`neutral`) → Inspected(`info`) → Approved(`success`) → Load Listed(`info`) →
  Loaded(`success`) / Not Loaded(`warning`) → Discharged(`neutral`) → Released(`success`);
  HOLD(`warning`), REJECTED(`danger`).
- **Documents (Load List/Manifest/B/L):** Draft(`neutral`) → Review(`info`) → Approved(`success`) →
  Issued(`success`) → Cancelled(`neutral`).
- **Financial (Invoice/Payment):** Draft(`neutral`) → Issued(`info`) → Partially Paid(`info`) →
  Paid(`success`) → Overdue(`warning`) → Reversed/Cancelled(`neutral`).
- **Voyage:** Draft(`neutral`) → Scheduled(`neutral`) → In Progress(`warning`) →
  Completed(`success`) → Cancelled(`neutral`). (Phase 6 state machine, ADR-026.)

When a stepper/progress component is implemented, current step = `primary`, completed = `success`
check, pending = `muted`. Numbers as well as colour (colour is never the only signal).

---

## 12. Dashboards

- **KPI cards:** grid `sm:grid-cols-2 xl:grid-cols-4`; each card = label (10px uppercase muted),
  value (`text-lg tabular-nums font-semibold`), optional trend chip only when computed from real data,
  and a `Badge` for status when relevant.
- Live indicators: name the source and refresh time; if not yet loaded show `PageLoader`, on failure
  `ErrorState`. Never show a number that isn't backed by the data source.
- Charts (when-added): line/bar for trends, donut only for small proportions; axes legible, no fake
  3D; respect reduced motion; formats match `@shipping/shared` formatters.
- Layout: title block → KPI band → panels (tables/charts) → activity list. Density as elsewhere.
- The foundation dashboard reflects **real** app/database health and registry-derived module counts
  (see `design-system/pages/dashboard.md`).

---

## 13. Maritime / Shipping UX Cues

- Icons (`lucide-react`, consistent 1.75px stroke line icons) for modules: `Container`, `Warehouse`,
  `Ship`, `Anchor`, `ScanSearch`, `ClipboardList`, `ScrollText`, `Truck`, `Users`, `CreditCard`,
  `BarChart3` etc. — from `lib/navigation/nav.ts`.
- Reference-number/ID rendering: `font-mono text-xs text-foreground/90` (e.g. `JOB-2026-00125`,
  container `MSKU1234567`, B/L `BL-001987`).
- Domain icons are functional, not decorative; decorative icons in empty states are `aria-hidden`.

---

## 14. Financial UX

- Money always `Decimal(18,2)`-safe in the domain layer; currency = ISO 4217 (`USD`, `AED`).
- Display: right-aligned, `tabular-nums`; 2 decimals; thousands separators; code-signed where relevant
  (configurable per company currency in settings; do NOT hardcode `$`).
- Negative numbers: leading minus, displayed in `foreground` (or red only in reconciliation contexts)
  — never parentheses unless the module (ledger) defines parenthetical convention.
- Totals/subtotals/grand totals: hierarchy via borders — subtotal `font-medium`, grand total
  `font-semibold` with `border-t-2`; all right-aligned.
- Invoice/payment/ledger statuses use the badge scheme in section 2.2. Debit/credit columns right-aligned,
  labelled, with running balance in `tabular-nums`.
- Formatting utilities live in `@shipping/shared` (`format.*`); UI renders through them exclusively.

---

## 15. Responsive Rules

Desktop-first; degrade gracefully.

| Breakpoint      | Behavior                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `lg` (1024+)    | Full sidebar, sidebar + topbar layout                                                                                                           |
| `md` (768–1023) | Collapsible/sidebar hidden behind menu button                                                                                                   |
| `< md` (mobile) | Sidebar → Sheet; filter bars → Sheet; page padding 16px; tables horizontal scroll (or column-stack for genuinely small screens in later phases) |
| `sm` (640)      | KPI grids collapse to 1–2 columns; topbar identity hides name shows avatar                                                                      |

Never let tables shrink into unreadable columns — use `overflow-x-auto` + sticky numeric columns.

---

## 16. Accessibility

- Keyboard: full tab order, escape closes overlays, focus moves into open dialogs/drawers,
  focus returns on close.
- Visible focus: `focus-visible:ring-2 ring-ring ring-offset-2` on all interactive elements.
- Contrast: WCAG AA (4.5:1 text). Status never colour-only (badge text always present).
- Semantics: real `<button>`, real `<a>`, `role="dialog" aria-modal aria-labelledby`, form fields
  labelled, errors `role="alert"` linked via `aria-describedby`.
- `sr-only` text for icon-only actions and live status changes (e.g. badge dot gains an `sr-only` note
  when the text label alone is insufficient).
- Motion: `@media (prefers-reduced-motion: reduce)` disables spin/pulse/transition animations
  (implemented in `globals.css`).
- Touch targets: interactive ≥ 40px on touch; icon buttons `h-9 w-9` minimum, `h-10` on touch contexts.
- Test new screens with keyboard-only and at 200% zoom; no content hidden behind sticky bars.

---

## 17. Interaction & Motion

Restraint is the motion rule.

- Transitions: `transition-colors` only on buttons/links (no layout shift); `transition-transform`
  for drawers/fade for scrims (150–200ms exit faster than enter).
- Loading: spinner `animate-spin` for discrete actions; skeleton pulse for panels; both disabled under
  reduced motion.
- No parallax, no scroll-story, no hover-morphing cards, no shake on error (move focus + message).

---

## 18. Component Architecture & Conventions

- **Location:** `apps/web/src/components/ui/*` (generic, business-free) and
  `apps/web/src/components/layout/*` (shell). Business pages compose these; no business logic inside
  generic components.
- All classes derive from tokens: `bg-background`, `text-muted-foreground`, `bg-primary/…`,
  `border-border`, `ring-ring`, `bg-success/12` etc. **No raw hex in components** (`validate-tokens`).
- `cn()` from `lib/utils` (clsx + tailwind-merge) is the class merge helper everywhere.
- Components are fully controlled (open/onOpenChange, value/onChange) so business logic stays in pages.
- Status colours referenced ONLY as semantic Tailwind colors (`success|warning|info|destructive`),
  never literal `emerald|amber|sky|red` classes.
- Icons: `lucide-react`, stroke 1.75 default; decorative icons behind text are `aria-hidden`.
- Keep components small and composable. Extend by composition, not by flags accumulation.

## 19. Repository map (design system)

| Path                               | Purpose                                     |
| ---------------------------------- | ------------------------------------------- |
| `design-system/MASTER.md`          | this file — global rules                    |
| `design-system/pages/*.md`         | page-specific overrides (read after Master) |
| `apps/web/src/app/globals.css`     | token implementation (HSL vars + utilities) |
| `apps/web/tailwind.config.ts`      | token mapping → Tailwind utility names      |
| `apps/web/src/components/ui/*`     | generic components                          |
| `apps/web/src/components/layout/*` | shell components                            |
| `docs/design-system.md`            | handoff guide summarising this system       |

## Dashboard refresh (2026-10)

The dashboard refresh evolves—not replaces—the semantic-token system above. Current light primary is
`215 74% 40%`, dark primary `211 85% 72%`; surfaces use calm blue-neutral tokens and restrained elevation.
The historical exact values above are superseded by `apps/web/src/app/globals.css`.
Inter, Vazirmatn and IBM Plex Sans Arabic are now **self-hosted** (no Google Fonts build fetch).
Use shared `Dialog`/`Sheet` for top-layer focus containment, `FormField` for stable label association,
`TableScroll` for keyboard-accessible wide tables, and preferences from `components/preferences`.
Motion must honor reduced-motion. Do not add hard-coded light backgrounds or status-only colors.
See `docs/ui/dashboard-redesign.md` for implementation boundaries and preview setup.
