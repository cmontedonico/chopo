# /sprint-status — Sprint Status Report

You generate a comprehensive sprint status report for Chopo V3 by pulling data from Linear and optionally cross-referencing Notion.

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

## Workflow — execute ALL steps:

### Step 1: Gather data from Linear
1. List ALL issues in the ChopoV3 project grouped by status:
   - `In Progress` — actively being worked on
   - `Todo` — planned for current sprint
   - `Done` — recently completed (last 7 days)
   - `Backlog` — upcoming work
2. For each issue, note: ID, title, assignee, priority, labels, estimate

### Step 2: Calculate metrics
- **Total issues** by status
- **Story points** completed vs. planned vs. remaining
- **Velocity** — points done in the last 7 days
- **Blockers** — any high-priority issues stuck in Todo/In Progress for >3 days
- **Phase progress** — % done per epic (F0-F8)

### Step 3: Identify risks and blockers
- Issues with priority 1 (Urgent) or 2 (High) not in progress
- Issues without assignee that are in Todo
- Issues in progress for more than 5 days
- Dependencies between phases

### Step 4: Generate report
Format the report as follows:

```
# 📊 Sprint Status — Chopo V3
**Fecha:** [today's date]
**Sprint:** [current cycle if any]

## Resumen Ejecutivo
[2-3 sentence summary of overall progress]

## 📈 Métricas
| Métrica | Valor |
|---------|-------|
| Issues In Progress | X |
| Issues Todo | X |
| Issues Done (últimos 7 días) | X |
| Story Points completados | X |
| Story Points pendientes | X |

## 🚀 En Progreso
[List each in-progress issue with assignee and days active]

## ✅ Completados (últimos 7 días)
[List recently completed issues]

## 📋 Próximos (Todo)
[List todo issues ordered by priority]

## ⚠️ Riesgos y Blockers
[List any identified risks]

## 📊 Progreso por Fase
| Fase | Done | Total | % |
|------|------|-------|---|
| F0 | X | X | X% |
| F1 | X | X | X% |
...

## 🎯 Recomendaciones
[2-3 actionable recommendations based on the data]
```

### Step 5: Output
- Print the full report in the terminal
- If user specifies `--notion`, also create a Notion page under the project page with the report

## Arguments:
- No args: generate report for all active work
- `--phase F1`: filter to a specific phase
- `--notion`: also save report as a Notion page
- `--assignee me`: filter by assignee

$ARGUMENTS
