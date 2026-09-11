# Design System — Handoff Guide

> Companion to the canonical `design-system/MASTER.md`. This page explains how to work with the system,
> where things live, and what future phases must do before writing UI.

## Source of truth

- **`design-system/MASTER.md`** — the binding visual/interaction language for the whole product
  (colour tokens, typography, spacing, radius, shell, tables, forms, dialogs, status semantics,
  financial UX, responsive, accessibility, motion, component conventions).
- **`design-system/pages/*.md`** — page-specific overrides, read after MASTER. Page rules take
  precedence over global rules when intentionally defined.

## Mandatory workflow for future UI work

> Any Agent or developer building UI in this repository MUST:
>
> 1. Read `design-system/MASTER.md`.
> 2. If the target page has `design-system/pages/<page>.md`, read it — its rules win on conflict.
> 3. Reuse components from `apps/web/src/components/ui` and `components/layout`. Do not restyle
>    globally; extend via tokens and composition.
> 4. Never introduce a competing visual system.

## Token conventions

- Implemented as HSL semantic variables in `apps/web/src/app/globals.css` (`:root` + `.dark`),
  mapped to Tailwind utilities in `apps/web/tailwind.config.ts` (e.g. `bg-success/12`,
  `text-muted-foreground`, `ring-ring`).
- Status colours are **semantic only**: `success`, `warning`, `info`, `destructive`. Raw palettes
  (`emerald-*`, `amber-*`, `red-*`, `sky-*`) are not allowed in components.
- Numeric/financial values use `tabluar-nums` (utility `.nums` or `tabular-nums`) and right align.
- Reference numbers/ids render in the mono stack (`font-mono text-xs`).
- No hardcoded hex values in components.

## Component conventions

- `apps/web/src/components/ui/*` = generic, business-free primitives (Button, Badge, Card, Alert,
  Dialog, ConfirmDialog, Sheet, Breadcrumbs, Loading, EmptyState, ErrorState).
- `apps/web/src/components/layout/*` = shell (Sidebar, Topbar, AppShell).
- Components are fully controlled (`open`/`onOpenChange`, `value`/`onChange`); business rules live in
  pages, never in generic components.
- `cn()` from `lib/utils` is the only class-merge helper.
- Icons: `lucide-react`; decorative icons behind text get `aria-hidden="true"`.

## How to design a new screen

1. Skim MASTER §0–§5 (principles, colour, type, spacing, radius).
2. Check §6 (shell), §7 (tables), §8 (filters), §9 (forms), §10 (dialogs) for the relevant patterns.
3. Reuse existing primitives; compose rather than fork.
4. Respect §2.2 status mapping and §16 accessibility (focus, contrast, reduced motion).
5. Verify with `pnpm lint`, `tsc --noEmit`, `next build` before finishing.

## Currently implemented tokens/utilities

- Semantic colours: background/foreground, card/popover, primary (+`primary-hover`), secondary,
  muted, accent, destructive, **success**, **warning**, **info** + foregrounds.
- Primary = **operational tracking-blue** (blue-600 `#2563EB`); canvas = cool neutral.
- Utilities: `scrollbar-thin`, `tabular-nums`/`.nums`, `micro-label`, `.panel`,
  `prefers-reduced-motion` guard.
- Badge status variants (`default|success|warning|danger|info|neutral|outline`) with optional `dot`
  and never-colour-only status.
- Inter (via `next/font/google`, `--font-sans` variable in root layout).
