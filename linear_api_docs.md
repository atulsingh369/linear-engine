# LINEAR ENGINE API DOCS

## Base URL

- Default:
  - `http://localhost:3001`
- Production:
  - `<your-production-url>`

## Authentication

- Required header on protected routes:
  - `x-exec-secret: <EXEC_SECRET>`
- Public routes (no auth required):
  - `GET /health`
  - `GET /debug/env`
- If missing or invalid:
  - `401 {"error":"Unauthorized"}`
- If server misconfigured:
  - `500 {"error":"Server misconfigured: EXEC_SECRET is missing."}`

## Health

- `GET /health`

### Example

- `curl http://localhost:3001/health`

### Response

- `{"ok":true}`

## Debug (optional)

- `GET /debug/env`

### Example

- `curl http://localhost:3001/debug/env`

### Response

- `{"hasExecSecret":true,"hasLinearKey":true}`

## List Issues

- `GET /list?project=<project-name>`

### Headers

- `x-exec-secret: <EXEC_SECRET>`

### Example

- `curl -H "x-exec-secret: $EXEC_SECRET" "http://localhost:3001/list?project=Core%20Platform"`

### Response

- `{"ok":true,"data":[{"id":"...","identifier":"COG-12","title":"...","state":{"name":"In Progress"},"projectMilestoneId":null,"createdAt":"2026-02-13T00:00:00.000Z","parentId":null,"assignee":{"displayName":"Atul"}}]}`

### Failure Modes

- Missing `project` query parameter:
  - `400 {"ok":false,"error":"Query parameter 'project' is required."}`
- Missing or invalid auth header:
  - `401 {"error":"Unauthorized"}`
- Linear/client validation errors:
  - `400 {"ok":false,"error":"<message>"}`
- Unhandled server error:
  - `500 {"ok":false,"error":"<message>"}`

## Status

- `GET /status/:id`

### Headers

- `x-exec-secret: <EXEC_SECRET>`

### Example

- `curl -H "x-exec-secret: $EXEC_SECRET" "http://localhost:3001/status/COG-12"`

### Response

- `{"ok":true,"data":{"issueKey":"COG-12","title":"...","state":"In Progress","assignee":"Atul","project":"Core Platform"}}`

### Failure Modes

- Issue not found or validation error:
  - `400 {"ok":false,"error":"<message>"}`
- Missing or invalid auth header:
  - `401 {"error":"Unauthorized"}`
- Unhandled server error:
  - `500 {"ok":false,"error":"<message>"}`

## Move Issue

- `POST /move`

### Headers

- `x-exec-secret: <EXEC_SECRET>`
- `Content-Type: application/json`

### Body

- `{"id":"<issue-key>","state":"<state-name>"}`

### Example

- `curl -X POST -H "x-exec-secret: $EXEC_SECRET" -H "Content-Type: application/json" -d '{"id":"COG-12","state":"In Progress"}' http://localhost:3001/move`

### Response

- `{"ok":true,"data":{"issueKey":"COG-12","previousState":"Todo","newState":"In Progress"}}`

### Failure Modes

- Missing or invalid auth header:
  - `401 {"error":"Unauthorized"}`
- Validation or Linear/client error:
  - `400 {"ok":false,"error":"<message>"}`
- Unhandled server error:
  - `500 {"ok":false,"error":"<message>"}`

## Comment

- `POST /comment`

### Headers

- `x-exec-secret: <EXEC_SECRET>`
- `Content-Type: application/json`

### Body

- `{"id":"<issue-key>","text":"<comment>"}`

### Example

- `curl -X POST -H "x-exec-secret: $EXEC_SECRET" -H "Content-Type: application/json" -d '{"id":"COG-12","text":"Deployed to staging"}' http://localhost:3001/comment`

### Response

- `{"ok":true,"data":{"issueKey":"COG-12"}}`

### Failure Modes

- Missing or invalid auth header:
  - `401 {"error":"Unauthorized"}`
- Validation or Linear/client error:
  - `400 {"ok":false,"error":"<message>"}`
- Unhandled server error:
  - `500 {"ok":false,"error":"<message>"}`

## Assign

- `POST /assign`

### Headers

- `x-exec-secret: <EXEC_SECRET>`
- `Content-Type: application/json`

### Body

- `{"id":"<issue-key>","user":"<identifier>"}`

### Example

- `curl -X POST -H "x-exec-secret: $EXEC_SECRET" -H "Content-Type: application/json" -d '{"id":"COG-12","user":"atul"}' http://localhost:3001/assign`

### Response

- `{"ok":true,"data":{"issueKey":"COG-12","assignee":"Atul"}}`

### Failure Modes

- Missing or invalid auth header:
  - `401 {"error":"Unauthorized"}`
- Validation or Linear/client error:
  - `400 {"ok":false,"error":"<message>"}`
- Unhandled server error:
  - `500 {"ok":false,"error":"<message>"}`

## Start

- `POST /start`

### Headers

- `x-exec-secret: <EXEC_SECRET>`
- `Content-Type: application/json`

### Body

- `{"id":"<issue-key>"}`

### Example

- `curl -X POST -H "x-exec-secret: $EXEC_SECRET" -H "Content-Type: application/json" -d '{"id":"COG-12"}' http://localhost:3001/start`

### Response

- `{"ok":true,"data":{"issueKey":"COG-12","previousState":"Todo","newState":"In Progress"}}`

### Failure Modes

- Missing or invalid auth header:
  - `401 {"error":"Unauthorized"}`
- Validation or Linear/client error:
  - `400 {"ok":false,"error":"<message>"}`
- Unhandled server error:
  - `500 {"ok":false,"error":"<message>"}`

## Sync Spec

- `POST /sync`

### Headers

- `x-exec-secret: <EXEC_SECRET>`
- `Content-Type: application/json`

### Body

- `{"filePath":"./linear-spec.json"}`

### Example

- `curl -X POST -H "x-exec-secret: $EXEC_SECRET" -H "Content-Type: application/json" -d '{"filePath":"./linear-spec.json"}' http://localhost:3001/sync`

### Response

- `{"ok":true,"data":{"actions":[{"status":"Created","entity":"project","name":"Core Platform"}]}}`

### Failure Modes

- Missing or invalid auth header:
  - `401 {"error":"Unauthorized"}`
- Validation or Linear/client error:
  - `400 {"ok":false,"error":"<message>"}`
- Unhandled server error:
  - `500 {"ok":false,"error":"<message>"}`

## Error Response Format

- `{"ok":false,"error":"<message>"}`
- Auth middleware error format:
  - `{"error":"Unauthorized"}`
  - `{"error":"Server misconfigured: EXEC_SECRET is missing."}`

## Security Notes

- `EXEC_SECRET` must be set.
- `LINEAR_API_KEY` must be set.
- API is stateless.
- Designed for AI agents and MCP usage.
- Not intended for public internet exposure without a reverse proxy.
