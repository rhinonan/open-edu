# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

班主任智慧工作台 — a single-class class-teacher workbench (Changsha primary school, grade 6), responsive on phone and desktop. Stack: Next.js 16 App Router + React 19 + TypeScript (strict) + Tailwind CSS 4, backed by an embedded SQLite database via Node's built-in `node:sqlite` (`DatabaseSync`). Requires **Node >= 22** (env runs 24). All UI text and seed data are in Chinese; write new UI in Chinese too.

## Commands

- `npm run dev` — dev server, binds `0.0.0.0:3000` so a phone on the same Wi-Fi can reach it
- `npm run build` / `npm start` — production mode
- `npm run lint` — ESLint (eslint-config-next)
- `npm test` — Vitest; run one file with `npx vitest run tests/<file>.test.ts`
- Tests use an in-memory SQLite DB and import `lib/` directly (`tests/`), no server needed

## Architecture

### Config-driven CRUD is the core pattern
A feature module is 4 small edits, and most `app/<module>/page.tsx` files are just a `CrudPageConfig` rendered by `<CrudPage>`:

1. Add the table to `SCHEMA_SQL` in `lib/schema.ts`
2. Add its key to `ResourceKey` in `lib/types.ts` and to `RESOURCES` in `lib/store.ts`
3. Create `app/<module>/page.tsx` (`'use client'`) defining a `CrudPageConfig` (columns, filters, stats, `defaultNewRow`, optional import template)
4. Done — generic routes + `CrudPage` provide list/filter/add/edit/delete/CSV export/import and per-user column show/hide (persisted in `localStorage`) for free

`CrudPage` (`components/crud/crud-page.tsx`) drives everything from the config; `DataTable` does inline editing (saves on blur/Enter). Hand-written pages exist only where the module needs bespoke UI: seats grid, timetable grid, dashboard, and homework's "录入收缴" modal flow.

### Data layer
- `lib/db.ts` exposes a singleton `getDb()` → `data/app.db` (WAL mode). `data/` is gitignored and auto-created.
- `lib/store.ts` implements generic `list/get/create/update/remove` over any `ResourceKey`. Table names come only from the `RESOURCES` allowlist and columns only from `PRAGMA table_info`, so unknown fields are silently dropped and identifiers can't be injected.
- `lib/seed.ts` seeds 45 fake students plus demo rows on first run (`seedIfEmpty`); `resetData` drops all tables and reseeds. `app/api/reset` triggers it from the settings page.
- Generic REST: `app/api/[resource]` (GET list / POST create) and `app/api/[resource]/[id]` (PUT / DELETE) serve every resource. Special-cased routes exist only for `dashboard`, `reset`, `backup`, and `students/import` (CSV upsert keyed on `idcard`; logic in `lib/import.ts`).

### Schema changes: reset, don't migrate
The project is not deployed and the DB holds only demo data — do **not** write migrations. On boot, `lib/db.ts` detects an old-schema `students` table via a sentinel column (`idcard`) and calls `resetData()`. When you change the schema, extend that PRAGMA-column check in `lib/db.ts` for the affected table so stale local `data/app.db` files self-heal.

### Docs / process
- Design docs and implementation plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/`, named `YYYY-MM-DD-<module>-<kind>.md`. New modules follow the design → plan → implement flow, and plans are executed with superpowers plan-execution skills.
- Commit messages use the `feat:` / `fix:` / `test:` / `chore:` prefix style (see the plan docs).

## Next.js 16 gotchas

`@AGENTS.md` carries an auto-generated warning: this Next.js version has breaking changes vs. training data, and the file is periodically rewritten by `next dev` (don't fight it). **Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code** and heed its deprecation notices. Note route handler params are `Promise<{...}>` and must be awaited (see `app/api/[resource]/route.ts`).