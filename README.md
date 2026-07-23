# VoiceSheets

Create, organize, and populate spreadsheets with **manual entry** or **AI-powered voice dictation**. Built for purchasing managers who need to turn spoken requests into clean, structured records fast.

VoiceSheets is a single, well-architected TypeScript codebase: **Next.js (App Router) + Prisma + PostgreSQL**, with **Anthropic Claude** for structured extraction and **Whisper** for transcription. It runs end-to-end in local development **without any third-party accounts** thanks to built-in fallbacks.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Optional integrations & fallbacks](#optional-integrations--fallbacks)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap: teams & permissions](#roadmap-teams--permissions)

---

## Features

**Templates → Spreadsheets → Rows**

- **Templates** define reusable column structures. Each column has a name, data type (text, long text, number, currency, date, boolean, dropdown), required flag, default, description, example, and an **AI hint** that tells the model what the field means.
- Create, edit, duplicate, archive, delete, reorder columns (drag-and-drop), and preview templates.
- **Spreadsheets** are created from a template and **snapshot** its columns at creation time, so editing a template never mutates historical data.
- **Rows** are added manually (dynamic, validated form) or by voice.

**Voice entry (flagship)**

- Record → transcribe (Whisper, or the browser Web Speech API as a fallback) → send transcript + full template metadata to Claude → get back a structured row with a **confidence score per field**.
- AI data is **never inserted directly**. A review dialog shows the transcript, the drafted row, and green / amber / red confidence indicators. Edit any value, then **Confirm & add**, **Regenerate**, or **Cancel**.
- Keep dictating corrections — "No, the quantity is thirty" — and the AI updates the pending row without starting over.

**Spreadsheet grid** (Airtable/Excel-like)

- Inline editing with **autosave**, sorting, searching, column resize & hide, pagination, **Excel-style keyboard navigation** (arrows, Enter, Tab, type-to-edit), **undo/redo** (⌘Z / ⌘⇧Z), row selection, bulk edit, and bulk delete.
- Toolbar: add row, **voice entry**, import, export, rename, duplicate, delete, version history, and numeric **stats** (sum / avg / min / max).

**More productivity**

- CSV / Excel **import with column mapping**; high-quality CSV / XLSX **export** preserving column order.
- Complete **version history** per spreadsheet with one-click **restore**.
- Global **search** (⌘K) across templates, spreadsheets, and row content.
- **AI clean-up** of selected rows (standardize vendor names, fix formatting/capitalization, normalize currencies).
- Duplicate-row detection, autocomplete from previously entered values, favorites, recent activity, audit log, dark/light mode, toasts, loading skeletons, confirmation dialogs, and user settings.

---

## Architecture

Clean separation of concerns, all in one TypeScript repo:

```
UI (React components, hooks)
   │  TanStack Query
   ▼
REST API route handlers  (src/app/api/**)      ← Zod validation, typed errors, pagination
   ▼
Service layer            (src/server/services) ← business logic, history + audit recording
   ▼
Prisma / PostgreSQL      (prisma/schema.prisma) ← normalized schema
```

- **AI is a dedicated service** (`src/server/services/ai-service.ts`), not embedded in UI: it builds prompts from template metadata, calls Claude, parses/validates/retries JSON, normalizes values, and returns strongly-typed results.
- **Auth** (`src/server/auth.ts`) resolves the current user via Clerk when configured, else a stable single-user dev identity — everything is scoped to a `Workspace` via a `Membership` join table so teams can be enabled later without a migration.
- The column-type system (`src/lib/columns.ts`) is the single source of truth for coercion, validation, formatting, and dynamic Zod-schema creation, shared by the form UI, grid, import, and AI service.

---

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS + shadcn/ui (new-york) |
| Data grid / forms | TanStack Table, React Hook Form, Zod |
| Server state | TanStack Query |
| Backend | Next.js Route Handlers + Prisma + PostgreSQL |
| Auth | Clerk (optional; dev fallback built in) |
| AI | Anthropic Claude (`claude-opus-4-8` by default) |
| Speech-to-text | OpenAI Whisper (optional; Web Speech API fallback) |
| Import/Export | PapaParse (CSV), SheetJS `xlsx` |
| Drag & drop | dnd-kit |
| Tests | Vitest + Testing Library |

---

## Quick start

Requires **Node 18+** and **Docker** (for local PostgreSQL).

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Copy env and start PostgreSQL
cp .env.example .env
docker compose up -d db

# 3. Apply the schema and seed sample data
npm run db:push
npm run db:seed

# 4. Run the app
npm run dev
```

Open <http://localhost:3000>. In dev mode you are signed in automatically as a local user, pre-populated with three sample templates and a demo spreadsheet.

> No Docker? Point `DATABASE_URL` at any PostgreSQL instance (Supabase, Neon, Railway, …) and run steps 3–4.

---

## Environment variables

See [`.env.example`](.env.example). Only `DATABASE_URL` is required.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | | Base URL (default `http://localhost:3000`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | | Enable Clerk auth |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | | Enable real Claude extraction |
| `OPENAI_API_KEY`, `WHISPER_MODEL` | | Enable server-side Whisper transcription |
| `VOICESHEETS_FORCE_DEV_AUTH` | | `true` forces single-user dev auth even if Clerk keys are present |

---

## Optional integrations & fallbacks

The app is designed to be fully functional without external accounts:

| Integration | When configured | Fallback |
|---|---|---|
| **Clerk** | Real sign-in/up, per-user data | Single-user "dev" identity (seeded automatically) |
| **Anthropic** | High-quality structured extraction | Deterministic heuristic parser (still returns confidence-scored fields) |
| **Whisper** | Server-side transcription | Browser Web Speech API, or manual transcript entry |

The **Settings → Integrations** panel shows which are active.

---

## Project structure

```
prisma/
  schema.prisma            Normalized schema (users, workspaces, templates, columns,
                           spreadsheets, rows, cells, history, settings, audit logs)
  seed.ts                  Sample templates + demo spreadsheet
src/
  app/
    (app)/                 Authenticated pages (dashboard, templates, spreadsheets, settings, activity)
    api/                   REST route handlers
    layout.tsx, page.tsx
  components/
    ui/                    shadcn primitives
    layout/                App shell, sidebar, top bar, theme toggle
    templates/             Template editor, drag-drop column rows, preview
    spreadsheet/           Data grid, cell editor, toolbar, dialogs, stats
    voice/                 Voice entry + review dialog
    search/                ⌘K command palette
  hooks/                   TanStack Query hooks (templates, spreadsheets, rows, ai, voice, settings, history)
  lib/                     columns, validations, types, api-client, export, confidence, utils, env
  server/
    auth.ts                Clerk-or-dev auth context
    http.ts                Typed errors, route wrapper, pagination
    serializers.ts         Prisma → DTO mapping
    services/              template / spreadsheet / row / history / audit / stats / search / settings / ai
tests/                     Vitest unit tests
```

---

## Data model

Normalized and future-proofed for teams. Key tables:

- `User`, `Workspace`, `Membership` (role: OWNER/ADMIN/EDITOR/VIEWER)
- `Template` → `TemplateColumn` (reusable structure)
- `Spreadsheet` (holds an immutable `columns` JSON snapshot) → `Row` → `Cell` (typed value + AI provenance: `aiGenerated`, `confidence`)
- `RowHistory` (per-change diff + full snapshot for restore)
- `UserSettings`, `AuditLog`

See [`prisma/schema.prisma`](prisma/schema.prisma) for the full, documented schema.

---

## API reference

All endpoints return `{ data }` (or `{ data, meta }` for lists) and `{ error: { message, code, details? } }` on failure.

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/templates` | List / create templates |
| `GET/PATCH/DELETE` | `/api/templates/:id` | Get / update / delete a template |
| `POST` | `/api/templates/:id/duplicate` | Duplicate a template |
| `GET/POST` | `/api/spreadsheets` | List / create spreadsheets |
| `GET/PATCH/DELETE` | `/api/spreadsheets/:id` | Get / update / delete |
| `POST` | `/api/spreadsheets/:id/duplicate` | Duplicate (optionally with rows) |
| `GET/POST` | `/api/spreadsheets/:id/rows` | List / create rows |
| `PATCH/DELETE` | `/api/spreadsheets/:id/rows/:rowId` | Update / delete a row |
| `PATCH/DELETE` | `/api/spreadsheets/:id/rows/bulk` | Bulk update / delete |
| `GET` | `/api/spreadsheets/:id/rows/:rowId/history` | Row history |
| `POST` | `/api/spreadsheets/:id/rows/:rowId/restore` | Restore a row version |
| `GET` | `/api/spreadsheets/:id/history` | Spreadsheet history |
| `GET` | `/api/spreadsheets/:id/stats` | Numeric column stats |
| `GET` | `/api/spreadsheets/:id/duplicates` | Duplicate-row groups |
| `GET` | `/api/spreadsheets/:id/suggest` | Autocomplete suggestions |
| `POST` | `/api/spreadsheets/:id/import` | Import mapped rows |
| `POST` | `/api/ai/extract` | Transcript → confidence-scored row |
| `POST` | `/api/ai/cleanup` | Standardize selected rows |
| `POST` | `/api/transcribe` | Whisper transcription |
| `GET` | `/api/search` | Global search |
| `GET/PATCH` | `/api/settings` | User settings |
| `GET` | `/api/audit` | Audit log |
| `GET` | `/api/me` | Current user + capabilities |

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Generate Prisma client + production build |
| `npm start` | Start the production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Vitest suite |
| `npm run db:push` | Push the schema to the database |
| `npm run db:migrate` | Create a migration |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio |

---

## Testing

```bash
npm test
```

Unit tests cover the column-type engine (coercion, validation, formatting) that the forms, grid, import, and AI service all depend on. Add feature tests under `tests/` or alongside source as `*.test.ts(x)`.

---

## Deployment

- **Vercel + Supabase/Neon**: set `DATABASE_URL` (and optional keys), then deploy. `npm run build` runs `prisma generate` automatically.
- **Docker**: `docker compose --profile full up --build` builds the app image (standalone output) and runs it alongside PostgreSQL.
- Run migrations against your production database with `npm run db:migrate` (or `prisma migrate deploy` in CI).

---

## Roadmap: teams & permissions

The schema and services are already workspace-scoped with a `Membership` role model. Enabling collaboration is additive:

1. Turn on Clerk, add an org/invite flow.
2. Expose workspace switching in the UI.
3. Enforce `Membership.role` in the service layer (helpers already receive the auth context).

No structural migration required.

---

Built with Next.js, Prisma, TanStack, shadcn/ui, and Claude.
