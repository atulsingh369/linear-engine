# linear-engine

`linear-engine` is a production-style command toolkit for AI coding workflows on top of [Linear](https://linear.app/).

It gives modern AI agents and developer tooling a reliable surface area to:

- inspect project and issue state,
- move work across workflow states,
- assign and comment on issues,
- sync project plans from JSON specs,
- expose the same capabilities over a secured HTTP API for MCP/automation use cases.

If you want your AI coding stack to operate on Linear with deterministic, scriptable behavior, this project is that bridge.

## Why this exists

Most AI coding tools are good at generating code but weak at operational task orchestration.

`linear-engine` turns Linear into a programmable execution layer:

- `CLI-first`: fast local commands for agents and humans.
- `API-ready`: secure HTTP endpoints for remote executors and MCP tools.
- `Spec-driven sync`: declarative project/epic/story sync from JSON.
- `Deterministic outputs`: `--json` everywhere for machine parsing.

## What you get

- 9 focused CLI commands (`status`, `move`, `comment`, `assign`, `start`, `list`, `projects`, `assign-project`, `sync`)
- Linear API client wrapper with normalized errors
- Sync engine with idempotent project updates, milestone creation/assignment, and assignee resolution from users or reference issues
- Managed metadata in descriptions (`managedBy: linear-engine`)
- Hono-based API server with shared core logic and `x-exec-secret` auth
- Test coverage for workflow, issue, project, and sync behavior

## Install

### Prerequisites

- Node.js `>= 18`
- A Linear API key (user-level personal API key)

### Setup

```bash
npm install
npm run build
```

Create `.env` in project root:

```env
LINEAR_API_KEY=lin_api_xxx
EXEC_SECRET=your-shared-secret
PORT=3001
```

## CLI usage

Build once, then run:

```bash
node dist/index.js <command> [options]
```

Or after install/build, use the bin directly:

```bash
linear <command> [options]
```

Global option:

- `--json` returns parseable JSON output (including JSON errors)

### Commands

#### 1) Issue status

```bash
linear status --id COG-12
linear status --id COG-12 --json
```

Returns issue key, title, state, assignee, and project.

#### 2) Move issue to state

```bash
linear move --id COG-12 --state "In Progress"
```

State match is case-insensitive inside the issue's team workflow.

#### 3) Add comment

```bash
linear comment --id COG-12 --text "Deployed to staging"
```

#### 4) Assign issue

```bash
linear assign --id COG-12 --user atul
```

`--user` can resolve by ID, username/name, display name, or email.

#### 5) Start issue

```bash
linear start --id COG-12
```

Moves issue to the first active workflow state (prefers `started` type).

#### 6) List issues in a project

```bash
linear list --project "Core Platform"
linear list --project "Core Platform" --json
```

Issues are sorted deterministically by `createdAt`, then `id`.

#### 7) List projects

```bash
linear projects
linear projects --json
```

#### 8) Assign project issues to current user

```bash
linear assign-project --project "Core Platform"
linear assign-project --project "Core Platform" --force
```

- default: assigns only unassigned issues
- `--force`: reassigns every issue in the project

#### 9) Sync from spec file

```bash
linear sync --file ./linear-spec.json
linear sync --file ./linear-spec.json --json
```

Creates/updates project entities and reports `Created`, `Updated`, `Skipped` actions.

### Command cheat sheet

| Command | Purpose |
| --- | --- |
| `status --id` | Read issue state, assignee, and project |
| `move --id --state` | Move issue to a workflow state |
| `comment --id --text` | Add issue comment |
| `assign --id --user` | Assign issue to a specific user |
| `start --id` | Move issue to first active workflow state |
| `list --project` | List project issues |
| `projects` | List workspace projects |
| `assign-project --project [--force]` | Bulk-assign project issues to current user |
| `sync --file` | Sync project/epics/stories/milestones from JSON |

## ProjectSpec (sync input)

`sync` expects a JSON file shaped like:

```json
{
  "project": {
    "name": "Core Platform",
    "description": "Execution engine for AI-assisted delivery."
  },
  "milestones": [
    { "name": "Phase 1" },
    { "name": "Phase 2" }
  ],
  "epics": [
    {
      "title": "Agent Runtime",
      "description": "Build runtime orchestration.",
      "assignee": "atul",
      "milestone": "Phase 1",
      "stories": [
        {
          "title": "Command Router",
          "description": "Implement command dispatch.",
          "assignee": "COG-99",
          "milestone": "Phase 2"
        }
      ]
    }
  ]
}
```

### Sync behavior highlights

- Creates project if missing; updates description if changed.
- Creates missing milestones referenced in top-level list or epic/story milestone fields.
- Creates epics/stories if missing by title (story matching includes parent epic).
- Preserves workflow state (does not move issues during sync).
- Adds managed metadata in issue descriptions: `managedBy: linear-engine`
- Assignee rules: explicit `assignee` is applied; omitted `assignee` defaults only for currently unassigned issues; issue-key references inherit assignee from that issue

## API server

Start API server:

```bash
npm run build
npm run start:api
```

Base URL: `http://localhost:3001` (or `PORT`)

Auth header for protected routes:

```http
x-exec-secret: <EXEC_SECRET>
```

Public routes:

- `GET /health`
- `GET /debug/env`

Protected routes:

- `GET /list?project=<name>`
- `GET /status/:id`
- `POST /move` body: `{ "id": "...", "state": "..." }`
- `POST /comment` body: `{ "id": "...", "text": "..." }`
- `POST /assign` body: `{ "id": "...", "user": "..." }`
- `POST /start` body: `{ "id": "..." }`
- `POST /sync` body: `{ "filePath": "./linear-spec.json" }`

Example:

```bash
curl -H "x-exec-secret: $EXEC_SECRET" \
  "http://localhost:3001/status/COG-12"
```

## Scripts

- `npm run build` builds `dist/` with `tsup`
- `npm run start:api` runs API server from compiled output
- `npm run dev:api` watch-build + restart API server
- `npm test` runs `vitest` suite
- `npm run test:watch` watch mode tests

## Architecture

- `src/cli.ts`: CLI command surface and output formatting
- `src/core/index.ts`: command-to-domain orchestration
- `src/linear/client.ts`: Linear SDK wrapper and error normalization
- `src/linear/issue.ts`: issue operations (status, move, comment, assign, start)
- `src/linear/project.ts`: project listing and assignment helpers
- `src/linear/sync.ts`: spec-driven sync engine
- `src/api/app.ts`: HTTP routes (Hono)
- `src/api/middleware/auth.ts`: `x-exec-secret` protection

## Built for AI coding tools

`linear-engine` works especially well when paired with:

- autonomous coding agents that need dependable task-state transitions,
- MCP servers or execution runtimes that call HTTP tools,
- CI/CD and release bots that must keep Linear up to date.

Use it as the operational backbone between "code generated" and "work actually moved."

## Troubleshooting

- `LINEAR_API_KEY is missing`: add it to `.env`
- `Server misconfigured: EXEC_SECRET is missing.`: set `EXEC_SECRET`
- `Issue not found: <key>`: verify issue key and workspace access
- `State not found in team workflow: <state>`: use exact team state name
- `Project not found: <name>`: verify project exists (or sync a spec to create it)

## License

No license file is currently included in this repository.
