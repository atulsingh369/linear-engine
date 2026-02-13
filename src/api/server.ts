import { serve } from "@hono/node-server";
import app from "./app";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), ".env")
});

if (!process.env.EXEC_SECRET) {
  console.error("FATAL: EXEC_SECRET not loaded");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3001);

serve(
  {
    fetch: app.fetch,
    port
  },
  (info: { port: number }) => {
    console.log(`linear-engine-api listening on http://localhost:${info.port}`);
  }
);
