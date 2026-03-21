import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { auth } from "./auth.js";

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

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "https://wohnly.app",
      "https://www.wohnly.app",
      "http://localhost:8081",
      "http://localhost:19006",
    ],
    credentials: true,
  })
);

// Better Auth handles its own routes
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

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

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

const port = Number(process.env.PORT) || 3001;
console.log(`Wohnly API starting on port ${port}`);

serve({ fetch: app.fetch, port });
