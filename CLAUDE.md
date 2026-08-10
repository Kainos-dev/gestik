# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Gestik ("Kainos Suite") — an internal CRM for a freelance/agency business to manage clients, recurring services, and payments. Next.js 16 (App Router) + React 19 + TypeScript, backed directly by Postgres (no ORM). All UI text, identifiers, and comments are in Spanish — follow that convention in new code.

## Commands

```bash
npm run dev             # start dev server (Next.js, Turbopack)
npm run build            # production build
npm run start             # run production build
npm run lint               # eslint (flat config: eslint-config-next core-web-vitals + typescript)

npm run migrate:up         # apply pending Postgres migrations (node-pg-migrate)
npm run migrate:down        # roll back the last migration
npm run migrate:create <name> # scaffold a new migration file in migrations/
```

There is no test runner configured in this repo (no test script, no Jest/Vitest dependency).

Migrations need `DATABASE_URL` set (see `.env`, gitignored). node-pg-migrate reads it via the `DATABASE_URL` env var by default.

## Architecture

**No ORM.** Prisma was removed (see git history, "goodbye Prisma"). Database access is raw SQL through a single shared `pg.Pool` in `src/lib/db.ts`, cached on `globalThis` so hot-reload in dev doesn't exhaust connections. Schema changes go through `node-pg-migrate` migration files in `migrations/` — there is no `schema.prisma` or generated client to keep in sync.

Postgres enums back the domain's state machines (`estado_cliente`, `tipo_servicio`, `frecuencia_servicio`, `estado_servicio`, `metodo_pago` — defined in `migrations/…create-tablas-iniciales.js`; `estado_cargo` doesn't exist as a DB enum, it's computed — see below). Zod schemas re-declare the same value sets as the single source of truth on the app side (e.g. `ESTADOS_CLIENTE` in `src/features/clients/schema.ts`) — when adding a new enum value, update both the migration and the corresponding Zod schema. One exception: the `moneda` enum (`ARS`/`USD`, migration `…agregar-moneda.js`) is cross-cutting — `servicios`, `cargos`, `pagos`, `gastos_fijos` and `gastos` all carry it, so its single source of truth lives in `src/lib/moneda.ts` (`MONEDAS`, `Moneda`, `formatCurrency`) instead of being re-declared per feature.

**Feature-based structure** under `src/features/<feature>/`, one directory per domain area (`clients`, `services`, `pagos`, `finanzas`, `dashboard`). Each feature is organized by responsibility rather than by component:
- `queries.ts` — read functions, `pool.query(...)` → mapped rows. Called from Server Components.
- `actions.ts` — `'use server'` mutations, called from client components/forms. Validate input with the feature's Zod schema, then write via `pool.query`, then `revalidatePath(...)`.
- `schema.ts` — Zod schemas (validation + inferred `*Input` types). Enum arrays here must mirror the Postgres enum definitions.
- `types.ts` — hand-written domain types plus a `mapX(row): X` function that converts a raw Postgres row (snake_case columns) into the camelCase shape the app uses. Any new query result must go through one of these mappers, not be used raw.
- `services.ts` (where present) — pure business-logic helpers with no I/O, e.g. `calcularEstadoCargo` in `cargos/services.ts` (derives PENDIENTE/PARCIAL/PAGADO/VENCIDO from how much of a cargo is covered) and `calcularProximoVencimiento` in `services/services.ts` (computes next due date from frequency). `pagos` has no `services.ts` — it's a pure data feature (schema/types/actions/queries/components only), all the payment-status logic lives in `cargos`.
- `components/` — feature-scoped React components (dialogs, forms, tables).

Some files carry stale header comments referencing older folder names (e.g. `clients/actions.ts` still says `// src/features/clientes/actions.ts`, `services/services.ts` says `servicios`) from a since-renamed directory. These are cosmetic leftovers, not a sign the file is in the wrong place — trust the actual file path over the comment.

**Routing**: pages live under the `(dashboard)` route group (`src/app/(dashboard)/`), sharing a layout (`src/app/(dashboard)/layout.tsx`) that renders `Sidebar` + `Topbar` around the page content. Nav entries are hardcoded in `src/components/layout/sidebar.tsx` (`NAV_ITEMS`) — add a link there when adding a new top-level page. There's essentially one API route (`src/app/api/servicios/por-cliente/route.ts`) for a client-side selector fetch; everything else goes through Server Components (queries) or Server Actions (mutations), not API routes.

**Data flow for client-driven mutations**: forms use `react-hook-form` + `@hookform/resolvers` bound to the feature's Zod schema, submit through a `useMutation` hook in `src/hooks/` that calls the server action, invalidates the relevant TanStack Query key, and shows a `sonner` toast on success/error (see `src/hooks/use-crear-cliente.ts` as the pattern to follow). `QueryClient` is set up once in `src/app/providers.tsx` (1 min `staleTime`, no refetch-on-focus — deliberate for an internal CRM's low write-contention usage).

**UI kit**: shadcn/ui components in `src/components/ui/` (style `base-vega`, Tailwind base color `neutral`, no `tailwind.config` — Tailwind v4 config lives in `src/app/globals.css`). Icons from `lucide-react`. Shared non-primitive components (data table, status badge) live in `src/components/shared/`. `src/lib/constants.ts` centralizes label/style maps for enum values (`ESTADO_STYLES`, `TIPO_SERVICIO_LABELS`, etc.) — extend these when adding a new enum value instead of inlining labels in components.

**React Compiler** is enabled (`next.config.ts` → `reactCompiler: true`, via `babel-plugin-react-compiler`) — avoid manual `useMemo`/`useCallback` micro-optimizations that fight the compiler; write plain component code.

## Domain model

- **clientes** (`clients` feature) — customers, `estado` ACTIVO/PAUSADO/FINALIZADO.
- **servicios** (`services` feature) — recurring or one-off services sold to a client, `frecuencia` UNICO/MENSUAL/ANUAL drives `proximo_vencimiento` calculation.
- **cargos** (`cargos` feature) — "lo que se debe cobrar" for a given period; generated automatically when a service is created or renewed (`crearServicio`/`renovarServicio` in `services/actions.ts`), copying the service's `precio` and `moneda` at that moment so a later price/currency change doesn't retroactively alter cargos already emitted. This is where payment status actually lives: `calcularEstadoCargo` (`cargos/services.ts`) derives PENDIENTE/PARCIAL/PAGADO/VENCIDO from how much of the cargo has been covered and whether its `periodo` has passed.
- **pagos** (`pagos` feature) — a pure receipt of money received; has no `estado` of its own (dropped in migration `quitar-estado-de-pagos` — "ahora es un recibo puro"). Payments are matched against cargos with a waterfall: `getCargos()` (`cargos/queries.ts`) applies each service's payments against that service's cargos oldest-period-first, so a payment isn't tied to one specific cargo — two payments can fully cover one month and partially cover the next even if that's not how the user mentally split them. A payment's `moneda` always mirrors the `moneda` of the service it's associated with (enforced server-side in `pagos/actions.ts`, ignoring whatever the client submitted) — you cannot pay a service in a different currency than it's priced in.
- **finanzas / gestion** — aggregate reporting (income by month/client, outstanding debt via `cargos`, payment history) over `pagos` and `cargos`. The page was recently renamed from `/finanzas` to `/gestion` (see uncommitted change moving `src/app/(dashboard)/finanzas` → `src/app/(dashboard)/gestion`); it still reads from `src/features/finanzas/`.
- **moneda** (ARS/USD, `src/lib/moneda.ts`) — every money-bearing table (`servicios`, `cargos`, `pagos`, `gastos_fijos`, `gastos`) carries a `moneda` column. Amounts are never converted or summed across currencies — every aggregate query (`getSaldoPorCliente`, `getKpis`, `getIngresosPorMes`, etc.) groups by `moneda` and returns one row/series per currency instead of a single blended total. `gastos`/`gastos_fijos` follow the same inherit-don't-choose pattern as pagos: a `gasto` tied to a `gastoFijoId` takes that fijo's `moneda` server-side.
