# Chopo V3 — Claude Code Context

## Project Overview

SaaS for medical test results management. Patients upload lab PDFs, the system extracts and stores each measurement atomically, generates tracking charts, enables sharing with doctors, and offers an AI copilot for personalized analysis. 8 phases (F1-F8), ~36 tasks, ~16 weeks.

## Assistant Reference Docs

- Start here for repo-wide context: this file.
- For the current Convex backend map, tables, file responsibilities, and test coverage, read [ARCHITECTURE.md](/Users/cmontedonico/repos/chopo/ARCHITECTURE.md).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.2.18 |
| Monorepo | Turborepo 2.8.12 |
| Backend / DB | Convex 1.32.0 (serverless + real-time database) |
| Auth | Better-Auth 1.4.9 + @convex-dev/better-auth |
| Frontend | React 19 + Vite + TanStack Router |
| Styling | Tailwind CSS 4.1.18 (OKLch tokens) + shadcn/ui (base-lyra) |
| UI Package | @chopo-v1/ui (shared components) |
| Linting | Oxlint 1.41.0 + Oxfmt 0.26.0 |
| Testing | Vitest (unit) + Playwright (E2E) |
| Deployment | Vercel (frontend) + Convex Cloud (backend) |
| File Storage | Convex File Storage |
| Payments | Stripe (MXN direct) |
| AI | Claude API (Anthropic SDK) |
| Email | Resend or AWS SES |

## Monorepo Structure

```
chopo-v1/
├── apps/
│   ├── web/                    # React 19 + Vite (port 3001) — main admin app
│   └── fumadocs/               # Next.js docs site (port 4000)
├── packages/
│   ├── backend/                # Convex backend (schema, functions, auth)
│   │   └── convex/
│   │       ├── schema.ts       # Database schema (Convex validators)
│   │       ├── auth.ts         # Better-Auth setup with Convex adapter
│   │       ├── auth.config.ts  # Auth config provider
│   │       ├── http.ts         # HTTP routes (auth endpoints)
│   │       ├── convex.config.ts # App definition + plugins
│   │       └── _generated/     # Auto-generated types (DO NOT EDIT)
│   ├── ui/                     # Shared component library
│   │   ├── src/components/     # shadcn/ui + custom components
│   │   ├── src/hooks/          # Shared React hooks
│   │   ├── src/lib/utils.ts    # cn() utility (clsx + tailwind-merge)
│   │   ├── src/styles/globals.css # Design tokens (OKLch)
│   │   └── components.json     # shadcn config (base-lyra style)
│   ├── env/                    # Type-safe env vars (@t3-oss/env-core)
│   └── config/                 # Shared TypeScript base config
```

## Import Aliases

```typescript
// In apps/web/
import { Button } from "@chopo-v1/ui/components/button"  // UI package
import { cn } from "@chopo-v1/ui/lib/utils"              // Utilities
import { Header } from "@/components/header"                  // Local (apps/web/src/)

// In packages/ui/
import { cn } from "@chopo-v1/ui/lib/utils"              // Self-reference
```

## Scripts

```bash
bun dev              # Start all apps (turbo dev)
bun dev:web          # Start web app only (port 3001)
bun dev:server       # Start Convex backend only
bun build            # Build all packages
bun check-types      # TypeScript type checking
bun check            # Oxlint + Oxfmt
```

## Linear Integration

| Key | Value |
|-----|-------|
| Team | Chopo |
| Team Key | VOX |
| Team ID | c15f64d9-7a13-4809-b10b-b1500ac8e43f |
| Project | ChopoV3 |
| Project ID | a330c398-9331-4d0e-9fc8-a2857f983cb2 |
| Project URL | https://linear.app/chopo/project/voxcloudv3-f893b7e80235 |
| Notion PRD | https://www.notion.so/32bde604ac9b80a0bfd0e5d8beeccb8e |

### Issue Statuses
- `Backlog` → `Todo` → `In Progress` → `Done` / `Canceled` / `Duplicate`

### Labels
- `Epic` — Parent epic issues
- `Historia de Usuario` — User stories
- `Tarea Técnica` — Technical tasks
- `Infraestructura` — DevOps/CI/CD
- `Migración de Datos` — Data migration scripts
- `Riesgo Alto` — High risk items

## Naming Conventions

### Git Branches
```
<type>/VOX-<number>-<kebab-description>

feat/VOX-962-schema-rbac-convex
fix/VOX-950-auth-rehash-md5
chore/VOX-973-github-actions-ci
refactor/VOX-951-user-permissions-types
test/VOX-975-playwright-setup
docs/VOX-974-contributing-guide
```

### Commits (Conventional Commits)
```
<type>(<scope>): description [VOX-XXX]

feat(convex): add users schema with RBAC permissions [VOX-962]
fix(auth): handle MD5 rehash edge case [VOX-950]
chore(ci): configure GitHub Actions workflow [VOX-973]
```

**Valid scopes:** `convex`, `auth`, `ui`, `web`, `admin`, `ci`, `config`, `docs`

### Files & Code
```
Components:    PascalCase.tsx     → UserPermissionsMatrix.tsx
Convex funcs:  camelCase.ts       → getUsersByRole.ts
Hooks:         use*.ts            → usePermission.ts
Routes:        kebab-case.tsx     → user-management.tsx
Types:         PascalCase         → UserRole, RolePermissions
Constants:     UPPER_SNAKE_CASE   → MAX_LOGIN_ATTEMPTS
```

## Convex Patterns

### Schema Definition
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tableName: defineTable({
    field: v.string(),
    optionalField: v.optional(v.string()),
    reference: v.id("otherTable"),
  }).index("by_field", ["field"]),
});
```

### Protected Query Pattern
```typescript
import { query } from "./_generated/server";
import { authComponent } from "./auth";

export const myQuery = query({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");
    // ... logic
  },
});
```

### Mutation Pattern
```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const myMutation = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");
    return await ctx.db.insert("tableName", { ...args, userId: user._id });
  },
});
```

## Frontend Patterns

### TanStack Router (File-based)
- `routes/__root.tsx` — Root layout
- `routes/index.tsx` — Home `/`
- `routes/dashboard.tsx` — `/dashboard`
- `routes/admin/users.tsx` — `/admin/users`
- `routes/admin/users.$userId.tsx` — `/admin/users/:userId`

### Data Fetching with Convex
```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "@chopo-v1/backend/convex/_generated/api";

// Query (reactive, real-time)
const users = useQuery(api.users.list);

// Mutation
const createUser = useMutation(api.users.create);
await createUser({ name: "John" });
```

### Form Pattern (TanStack Form + Zod)
```typescript
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1) });

const form = useForm({
  defaultValues: { name: "" },
  onSubmit: async ({ value }) => { /* mutation */ },
});
```

## Phases & Epics Reference

| Phase | Name | Weeks | Tasks |
|-------|------|-------|-------|
| F1 | Schema & Data Foundation | 2 | 6 |
| F2 | PDF Upload & Parsing | 2 | 5 |
| F3 | Dashboard & Visualizaciones | 2 | 4 |
| F4 | Métricas Manuales | 1 | 3 |
| F5 | Portal Médico & Compartir | 2 | 5 |
| F6 | Mensajería & Notificaciones | 2 | 4 |
| F7 | Pagos con Stripe | 2 | 4 |
| F8 | AI Copilot & Correlaciones | 3 | 5 |

Full PRD with tasks and prompts: [Notion PRD](https://www.notion.so/32bde604ac9b80a0bfd0e5d8beeccb8e)

## Environment Variables

### apps/web/.env
```
VITE_CONVEX_URL=<convex-deployment-url>
VITE_CONVEX_SITE_URL=<convex-site-url>
```

### packages/backend/.env.local
```
CONVEX_DEPLOYMENT=<deployment-name>
ANTHROPIC_API_KEY=<claude-api-key>
STRIPE_SECRET_KEY=<stripe-secret>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
RESEND_API_KEY=<resend-api-key>
```

## Rules

- NEVER use `any` — project is strict TypeScript
- NEVER use `as` type assertions without justification
- ALWAYS use Convex validators (`v.string()`, `v.id()`) not Zod in schema
- ALWAYS use `cn()` for Tailwind class merging
- ALWAYS use design tokens from globals.css, not hardcoded colors
- ALWAYS reference Linear issue ID in branch names and commit messages
- NEVER edit files in `_generated/` directories
- Prefer `bun` over `npm`/`yarn`/`pnpm`
