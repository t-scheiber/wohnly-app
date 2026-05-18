import { Hono } from "hono";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();

const MIN_VERSION = process.env.WOHNLY_MIN_APP_VERSION ?? "1.3.0";
const CURRENT_VERSION = process.env.WOHNLY_CURRENT_APP_VERSION ?? "1.3.2";

// GET /api/app/min-version — clients call this to detect they need to update.
// Unauthenticated so stale clients can still check.
app.get("/min-version", (c) => {
  return c.json({
    minVersion: MIN_VERSION,
    currentVersion: CURRENT_VERSION,
  });
});

export default app;
