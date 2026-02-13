import { Context, Next } from "hono";

export async function loggerMiddleware(c: Context, next: Next): Promise<void> {
  const startedAt = Date.now();

  await next();

  const durationMs = Date.now() - startedAt;
  console.log(
    `${c.req.method} ${c.req.path} ${c.res.status} ${durationMs}ms`
  );
}
