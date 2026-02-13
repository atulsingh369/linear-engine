import { Hono } from "hono";
import {
  assignIssue,
  commentIssue,
  getIssueStatus,
  listProjectIssues,
  moveIssue,
  startIssue,
  syncSpec
} from "../core";
import { authMiddleware } from "./middleware/auth";
import { loggerMiddleware } from "./middleware/logger";

interface MoveRequest {
  id: string;
  state: string;
}

interface AssignRequest {
  id: string;
  user: string;
}

interface StartRequest {
  id: string;
}

interface CommentRequest {
  id: string;
  text: string;
}

interface SyncRequest {
  filePath: string;
}

const app = new Hono();

app.use("*", loggerMiddleware);
app.use("*", async (c, next) => {
  if (c.req.path === "/health" || c.req.path === "/debug/env") {
    await next();
    return;
  }

  return authMiddleware(c, next);
});

app.get("/health", (c) => c.json({ ok: true }));
app.get("/debug/env", (c) =>
  c.json({
    hasExecSecret: Boolean(process.env.EXEC_SECRET),
    hasLinearKey: Boolean(process.env.LINEAR_API_KEY)
  })
);

app.get("/status/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const status = await getIssueStatus(id);
    return c.json({ ok: true, data: status }, 200);
  } catch (error) {
    return c.json({ ok: false, error: toErrorMessage(error) }, 400);
  }
});

app.post("/move", async (c) => {
  try {
    const body = await c.req.json<MoveRequest>();
    const result = await moveIssue(body.id, body.state);
    return c.json({ ok: true, data: result }, 200);
  } catch (error) {
    return c.json({ ok: false, error: toErrorMessage(error) }, 400);
  }
});

app.post("/assign", async (c) => {
  try {
    const body = await c.req.json<AssignRequest>();
    const result = await assignIssue(body.id, body.user);
    return c.json({ ok: true, data: result }, 200);
  } catch (error) {
    return c.json({ ok: false, error: toErrorMessage(error) }, 400);
  }
});

app.post("/start", async (c) => {
  try {
    const body = await c.req.json<StartRequest>();
    const result = await startIssue(body.id);
    return c.json({ ok: true, data: result }, 200);
  } catch (error) {
    return c.json({ ok: false, error: toErrorMessage(error) }, 400);
  }
});

app.post("/comment", async (c) => {
  try {
    const body = await c.req.json<CommentRequest>();
    const result = await commentIssue(body.id, body.text);
    return c.json({ ok: true, data: result }, 200);
  } catch (error) {
    return c.json({ ok: false, error: toErrorMessage(error) }, 400);
  }
});

app.post("/sync", async (c) => {
  try {
    const body = await c.req.json<SyncRequest>();
    const result = await syncSpec(body.filePath);
    return c.json({ ok: true, data: result }, 200);
  } catch (error) {
    return c.json({ ok: false, error: toErrorMessage(error) }, 400);
  }
});

app.get("/list", async (c) => {
  try {
    const project = c.req.query("project");
    if (!project) {
      return c.json({ ok: false, error: "Query parameter 'project' is required." }, 400);
    }

    const issues = await listProjectIssues(project);
    return c.json({ ok: true, data: issues }, 200);
  } catch (error) {
    return c.json({ ok: false, error: toErrorMessage(error) }, 400);
  }
});

app.onError((error, c) => {
  return c.json({ ok: false, error: toErrorMessage(error) }, 500);
});

app.notFound((c) => c.json({ ok: false, error: "Not found" }, 404));

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export default app;
