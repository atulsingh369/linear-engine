# LINEAR ENGINE CLI DOCS

## linear-engine CLI Updates

### New Commands

- `linear status --id <issue-key>`
  - Shows issue key, title, current state, assignee, and project.
- `linear comment --id <issue-key> --text "<text>"`
  - Adds a comment to an issue.
- `linear assign --id <issue-key> --user <username-or-id>`
  - Assigns a specific user to an issue.
- `linear start --id <issue-key>`
  - Moves an issue to the first active workflow state.
- `linear list --project "<project-name>" [--json]`
  - Lists project issues with deterministic `createdAt` ascending order.
  - Includes: `id`, `identifier`, `title`, `state.name`, `projectMilestoneId`, `createdAt`, `parentId`, `assignee.displayName`.
  - Default output is a readable table; `--json` returns a structured JSON array.
- `linear projects [--json]`
  - Lists all projects in the workspace.
  - Includes: `id`, `name`, `state`, `progress`, `startDate`, `targetDate`, `lead.displayName`, `createdAt`, `updatedAt`.
  - Default output is a readable table; `--json` returns a structured JSON array.

### Enhanced Commands

- `linear move --id <issue-key> --state "<state name>"`
  - Supports key-based move with state lookup by name (case-insensitive).
- `linear sync --file <path>`
  - Supports optional assignee rules on epics/stories via `assignee` field.
  - Supports optional milestone mapping on epics/stories via `milestone` field.
  - If `assignee` is set, sync resolves and applies it.
  - If not set, sync defaults to current authenticated user only when issue is unassigned.
  - Milestone mapping behavior:
    - Epic: `epic.milestone` if provided, otherwise milestone matching epic title from `spec.milestones`.
    - Story: `story.milestone` if provided, otherwise inherits `epic.milestone`.
  - Epics and stories are attached to milestones with `projectMilestoneId`.
  - Preserves existing workflow state (does not change `stateId`).
  - Adds `managedBy: linear-engine` metadata block to synced issue descriptions.
- `linear assign-project --project "<project-name>" [--force]`
  - Default mode assigns only unassigned issues.
  - `--force` reassigns all issues in the project.

### Global Output Option

- `--json`
  - Available on all commands.
  - Prints parseable JSON output and JSON error payloads.

## Example Usage

- `linear status --id COG-12`
- `linear move --id COG-12 --state "In Progress"`
- `linear comment --id COG-12 --text "Deployed to staging"`
- `linear assign --id COG-12 --user atul`
- `linear start --id COG-12`
- `linear list --project "Core Platform"`
- `linear list --project "Core Platform" --json`
- `linear projects`
- `linear projects --json`
- `linear assign-project --project "Core Platform"`
- `linear assign-project --project "Core Platform" --force`
- `linear sync --file ./specs/project.json --json`
- `linear sync --file ./linear-spec.json`

### ProjectSpec additions

- `EpicSpec.milestone?: string`
- `StorySpec.milestone?: string`

## Expected Outputs

- Move (non-JSON):
  - `Moved COG-12 from Todo to In Progress`
- Status (JSON):
  - `{"issueKey":"COG-12","title":"...","state":"...","assignee":"...","project":"..."}`
- Assign project summary:
  - `Total issues: N`
  - `Assigned count: N`
  - `Skipped count: N`
- Projects list (JSON item shape):
  - `{"id":"...","name":"...","state":"...","progress":42,"startDate":"...","targetDate":"...","lead":{"displayName":"..."},"createdAt":"...","updatedAt":"..."}`

## Failure Modes

- Issue key not found:
  - `Error: Issue not found: <key>`
- State not found for team workflow:
  - `Error: State not found in team workflow: <state>`
- Project not found:
  - `Error: Project not found: <project-name>`
- User not found:
  - `Error: User not found: <user>`
- Invalid sync file / schema:
  - `Error: Failed to read spec file ...`
  - `Error: Invalid JSON in ...`
  - `Error: Invalid ProjectSpec in ...`
