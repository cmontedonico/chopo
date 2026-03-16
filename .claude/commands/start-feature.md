# /start-feature — Feature Kickoff Workflow

You are the feature kickoff orchestrator for Chopo V3. You combine Notion PRD reading, Linear issue creation, branch naming, and file scaffolding into a single workflow.

## Hardcoded context — ALWAYS use these values:
- **Team:** Chopo
- **Team ID:** c15f64d9-7a13-4809-b10b-b1500ac8e43f
- **Project:** ChopoV3
- **Project ID:** a330c398-9331-4d0e-9fc8-a2857f983cb2

## Epics reference:
| Phase | Epic | Linear ID |
|-------|------|-----------|
| F0 | Infraestructura DevOps, CI/CD | VOX-971 |
| F1 | Fundación, Auth y Usuarios | VOX-917 |
| F2 | Tiendas y Directorio | VOX-918 |
| F3 | CallCenter y Portal Cliente | VOX-919 |
| F4 | Ventas y CRM | VOX-920 |
| F5 | Contenido S3+CDN | VOX-921 |
| F6 | Playlists y Crons | VOX-922 |
| F7 | Cutover PHP | VOX-923 |
| F8 | Agentic AI Copilot | VOX-961 |

## Notion PRD pages:
- F0: https://www.notion.so/320de604ac9b8163bd7edb0d8fc7ab85
- F1: https://www.notion.so/30bde604ac9b810c80e3e0eae4c9ee6c
- F2: https://www.notion.so/30bde604ac9b81f0ba3bfcd9b570e0a0
- F3: https://www.notion.so/30bde604ac9b8127bfd7f9afb79205db
- F4: https://www.notion.so/30bde604ac9b81639f86cfde4edb8828
- F5: https://www.notion.so/30bde604ac9b81d4b92beeb566aae7de
- F6: https://www.notion.so/30bde604ac9b81e88d2ce656e4ddfac6
- F7: https://www.notion.so/30bde604ac9b813baba5eee725b0a94a
- F8: https://www.notion.so/31ede604ac9b8197961edd39ed188abb

## Workflow — execute ALL steps in order:

### Step 1: Understand the feature
Determine what the user wants to build. Input can be:
- **A description:** "user authentication with email/password"
- **A Linear issue ID:** "VOX-950"
- **A phase + story:** "F1 — login flow"

If a Linear issue ID is provided:
1. Fetch the issue details from Linear
2. Read its description for requirements
3. Skip to Step 3

If a description or phase is provided:
1. Identify which epic/phase it belongs to (F0-F8)
2. Read the corresponding Notion PRD page for full context
3. Extract: acceptance criteria, technical requirements, dependencies

### Step 2: Create Linear issues (if they don't exist)
Create the necessary issues in Linear with:
- **Parent epic:** Link to the correct phase epic (VOX-917 through VOX-971)
- **Title convention:**
  - Story: `[HISTORIA] Description`
  - Task: `[TAREA] Description`
- **Labels:** At least one of: `Historia de Usuario`, `Tarea Técnica`, `Infraestructura`
- **Priority:** Based on phase order and dependencies (1-4)
- **Estimate:** Story points (1, 2, 3, 5, 8, 13, 21) based on complexity
- **Status:** `Todo`

If the feature is complex, create:
1. One parent story (`[HISTORIA]`)
2. Multiple sub-tasks (`[TAREA]`) linked to the story

### Step 3: Generate branch name
Based on the main Linear issue, generate:
```
<type>/VOX-<number>-<kebab-description>
```
Types: `feat`, `fix`, `chore`, `test`, `refactor`

Example: `feat/VOX-962-schema-rbac-convex`

### Step 4: Create the branch
```bash
git checkout -b <branch-name>
```

### Step 5: Scaffold files
Based on the feature type, create initial files:

#### For Convex backend features:
```
packages/backend/convex/<domain>.ts          — Functions file
packages/backend/convex/<domain>.test.ts     — Test file (empty template)
```
With boilerplate:
```typescript
// packages/backend/convex/<domain>.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// TODO: Implement <feature>
```

#### For Frontend features:
```
apps/web/src/routes/<path>/index.tsx         — Page route
apps/web/src/routes/<path>/-components/      — Page-specific components dir
```
With boilerplate:
```typescript
// apps/web/src/routes/<path>/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("<path>")({
  component: RouteComponent,
});

function RouteComponent() {
  // TODO: Implement <feature>
  return <div>TODO: <feature></div>;
}
```

#### For Full-stack features:
Create both backend and frontend files.

### Step 6: Update Linear issue status
Move the main issue to `In Progress`:
```
Status: In Progress
```

### Step 7: Print summary
Output a clear summary:
```
## 🚀 Feature Started: <title>

### Linear
- Story: VOX-XXX — <title> (In Progress)
- Tasks: VOX-YYY, VOX-ZZZ

### Branch
`feat/VOX-XXX-description`

### Files Created
- packages/backend/convex/<file>.ts
- apps/web/src/routes/<path>/index.tsx

### Acceptance Criteria (from PRD)
- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Criteria 3

### Next Steps
1. Implement backend functions in `packages/backend/convex/<file>.ts`
2. Build UI components in `apps/web/src/routes/<path>/`
3. Write tests
4. Run `/review` before committing
```

## Arguments:
- Feature description, Linear issue ID, or phase reference
- `--no-scaffold`: skip file creation
- `--no-branch`: skip branch creation
- `--backend-only`: only scaffold backend files
- `--frontend-only`: only scaffold frontend files

$ARGUMENTS
