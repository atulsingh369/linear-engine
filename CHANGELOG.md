# CHANGELOG

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

### Enhanced Commands

- `linear move --id <issue-key> --state "<state name>"`
  - Supports key-based move with state lookup by name (case-insensitive).
  - Also continues to support `--issue "<title>"`.
- `linear sync --file <path>`
  - Supports optional assignee rules on epics/stories via `assignee` field.
  - If `assignee` is set, sync resolves and applies it.
  - If not set, sync defaults to current authenticated user only when issue is unassigned.
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
- `linear assign-project --project "Core Platform"`
- `linear assign-project --project "Core Platform" --force`
- `linear sync --file ./specs/project.json --json`

## Expected Outputs

- Move (non-JSON):
  - `Moved COG-12 from Todo to In Progress`
- Status (JSON):
  - `{"issueKey":"COG-12","title":"...","state":"...","assignee":"...","project":"..."}`
- Assign project summary:
  - `Total issues: N`
  - `Assigned count: N`
  - `Skipped count: N`

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
