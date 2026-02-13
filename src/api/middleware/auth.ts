import { Context, Next } from "hono";

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const expectedSecret = process.env.EXEC_SECRET;
  if (!expectedSecret) {
    return c.json({ error: "Server misconfigured: EXEC_SECRET is missing." }, 500);
  }

  const providedSecret = c.req.header("x-exec-secret");
  if (!providedSecret || providedSecret !== expectedSecret) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
}
