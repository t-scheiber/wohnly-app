import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { auth } from "./auth.js";
import type { AppEnv } from "./types.js";

import householdsRouter from "./routes/households.js";
import membersRouter from "./routes/members.js";
import invitationsRouter from "./routes/invitations.js";
import deletionRouter from "./routes/deletion.js";
import todosRouter from "./routes/todos.js";
import personalTodosRouter from "./routes/personal-todos.js";
import shoppingRouter from "./routes/shopping.js";
import choresRouter from "./routes/chores.js";
import eventsRouter from "./routes/events.js";
import expensesRouter from "./routes/expenses.js";
import subscriptionsRouter from "./routes/subscriptions.js";
import devicesRouter from "./routes/devices.js";
import itemsRouter from "./routes/items.js";
import pushRouter from "./routes/push.js";
import userRouter from "./routes/user.js";
import webhooksRouter from "./routes/webhooks.js";
import widgetsRouter from "./routes/widgets.js";
import mealsRouter from "./routes/meals.js";
import streamRouter from "./routes/stream.js";
import accessRouter from "./routes/access.js";
import envelopesRouter from "./routes/envelopes.js";
import epochsRouter from "./routes/epochs.js";
import appVersionRouter from "./routes/app-version.js";
import { eventListener } from "./lib/events/listener.js";
import { startExpireAccessRequestsCron } from "./cron/expire-access-requests.js";

const app = new Hono<AppEnv>();

// ── Rate Limiting (Simple Memory Implementation) ──
const rateLimits = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // 100 requests per minute

app.use("*", async (c, next) => {
  // Skip rate limiting for webhooks (Stripe/RevenueCat)
  if (c.req.path.startsWith("/api/webhooks")) return await next();

  const ip = c.req.header("x-forwarded-for") || "anonymous";
  const now = Date.now();
  const limit = rateLimits.get(ip);

  if (limit && now < limit.reset) {
    if (limit.count >= MAX_REQUESTS) {
      return c.json({ error: "Too many requests. Please try again in a minute." }, 429);
    }
    limit.count++;
  } else {
    rateLimits.set(ip, { count: 1, reset: now + RATE_LIMIT_WINDOW });
  }

  // Cleanup old entries occasionally (1% chance per request)
  if (Math.random() < 0.01) {
    for (const [key, val] of rateLimits.entries()) {
      if (now > val.reset) rateLimits.delete(key);
    }
  }

  await next();
});

// Middleware
app.use("*", logger());

// Security Headers
app.use("*", async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  await next();
});

app.use(
  "*",
  cors({
    origin: [
      "https://wohnly.app",
      "https://www.wohnly.app",
      "http://localhost:8081",
      "http://localhost:19006",
      "tauri://localhost",
      "http://tauri.localhost",
      "https://tauri.localhost",
    ],
    credentials: true,
  })
);

// Tauri desktop: browsers forbid setting the Cookie header in fetch(),
// so the Tauri client sends the session token via x-session-token.
// Convert it to a Cookie header so Better Auth can read it.
app.use("*", async (c, next) => {
  const sessionToken = c.req.header("x-session-token");
  if (sessionToken && !c.req.header("cookie")) {
    const cookieName = "__Secure-better-auth.session_token";
    const newHeaders = new Headers(c.req.raw.headers);
    newHeaders.set("cookie", `${cookieName}=${sessionToken}`);
    const newRequest = new Request(c.req.raw, { headers: newHeaders });
    // Replace the raw request so downstream handlers see the cookie
    Object.defineProperty(c.req, "raw", { value: newRequest, writable: true });
  }
  await next();
});

// Tauri desktop OAuth callback: serves an HTML page that redirects to
// the wohnly:// deep link and tells the user they can close the tab.
// Must be outside /api/auth/* to avoid the Better Auth wildcard.
app.get("/api/tauri-callback", (c) => {
  const cookie = c.req.query("cookie") ?? "";
  const deepLink = `wohnly://auth/callback?cookie=${encodeURIComponent(cookie)}`;
  return c.html(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Wohnly</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f1a1a;color:#fff;text-align:center}
.box{max-width:360px}h2{margin-bottom:8px}p{color:#aaa;font-size:14px}</style></head>
<body><div class="box"><h2>Login successful</h2><p>Returning to Wohnly...</p>
<p style="margin-top:24px;font-size:12px;color:#666">You can close this tab.</p></div>
<script>window.location.href=${JSON.stringify(deepLink)};setTimeout(()=>window.close(),1500)</script>
</body></html>`);
});

// Better Auth handles its own routes.
// Hono uses `*` as the wildcard matcher for nested paths.
// Wrap to intercept wohnly:// redirects — browsers block 302 to custom
// schemes, so we serve an HTML page that redirects via JavaScript instead.
async function handleAuth(c: any) {
  const res = await auth.handler(c.req.raw);
  const location = res.headers.get("location");
  if (location && location.startsWith("wohnly://")) {
    return c.html(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Wohnly</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f1a1a;color:#fff;text-align:center}
.box{max-width:360px}h2{margin-bottom:8px}p{color:#aaa;font-size:14px}</style></head>
<body><div class="box"><h2>Login successful</h2><p>Returning to Wohnly...</p>
<p style="margin-top:24px;font-size:12px;color:#666">You can close this tab.</p></div>
<script>window.location.href=${JSON.stringify(location)};setTimeout(()=>window.close(),1500)</script>
</body></html>`);
  }
  return res;
}
app.all("/api/auth", handleAuth);
app.all("/api/auth/*", handleAuth);

// API Routes
app.route("/api/households", householdsRouter);
app.route("/api/members", membersRouter);
app.route("/api/invitations", invitationsRouter);
app.route("/api/deletion", deletionRouter);
app.route("/api/todos", todosRouter);
app.route("/api/personal-todos", personalTodosRouter);
app.route("/api/shopping", shoppingRouter);
app.route("/api/chores", choresRouter);
app.route("/api/events", eventsRouter);
app.route("/api/expenses", expensesRouter);
app.route("/api/subscriptions", subscriptionsRouter);
app.route("/api/devices", devicesRouter);
app.route("/api/items", itemsRouter);
app.route("/api/push", pushRouter);
app.route("/api/user", userRouter);
app.route("/api/webhooks", webhooksRouter);
app.route("/api/widgets", widgetsRouter);
app.route("/api/meals", mealsRouter);
app.route("/api/stream", streamRouter);
app.route("/api/access", accessRouter);
// Multiple routers under /api/households — envelopes + epochs + the existing households router.
// Hono composes them; each contributes its own sub-routes.
app.route("/api/households", envelopesRouter);
app.route("/api/households", epochsRouter);
app.route("/api/app", appVersionRouter);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Desktop download — proxies the macOS GitHub release (Windows is on Microsoft Store)
app.get("/download/:file", async (c) => {
  const file = c.req.param("file");
  if (file.toLowerCase().includes("windows")) {
    return c.text("Windows builds are available on the Microsoft Store", 410);
  }
  const ghUrl = `https://github.com/t-scheiber/wohnly-app/releases/download/desktop-latest/${file}`;
  const res = await fetch(ghUrl, { redirect: "follow" });
  if (!res.ok) return c.text("Not found", 404);
  c.header("Content-Type", "application/octet-stream");
  c.header("Content-Disposition", `attachment; filename="${file}"`);
  if (res.headers.get("content-length")) {
    c.header("Content-Length", res.headers.get("content-length")!);
  }
  return c.body(res.body as ReadableStream);
});

// Redirect API root to web app (catches OAuth post-redirect)
app.get("/", (c) => c.redirect(process.env.APP_URL ?? "https://wohnly.app"));

// ── Error & 404 Handlers ──

app.notFound((c) => {
  return c.json({ error: `Not Found - ${c.req.path}` }, 404);
});

app.onError((err, c) => {
  console.error(`[API ERROR] ${c.req.method} ${c.req.path}:`, err);

  // Prisma unique constraint error (e.g., P2002)
  if (err.name === "PrismaClientKnownRequestError" && (err as any).code === "P2002") {
    return c.json({ error: "A record with this value already exists." }, 409);
  }

  // Handle generic errors
  const status = (err as any).status || 500;
  return c.json(
    {
      error: err.message || "Internal Server Error",
      ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
    },
    status
  );
});

const port = Number(process.env.PORT) || 3001;
console.log(`Wohnly API starting on port ${port}`);

eventListener.start().catch((err) => {
  console.error("[events] failed to start listener", err);
  process.exit(1);
});

startExpireAccessRequestsCron();

serve({ fetch: app.fetch, port });
