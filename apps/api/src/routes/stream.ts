import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { requireAuth } from "../middleware/auth.js";
import { sseRegistry } from "../lib/events/sse-registry.js";
import type { AppEnv } from "../types.js";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", (c) => {
  const userId = c.get("userId");
  return streamSSE(c, async (stream) => {
    let closed = false;
    const unregister = sseRegistry.register({
      userId,
      send: (event, data) => {
        if (closed) return;
        stream.writeSSE({ event, data }).catch(() => {
          /* stream closed */
        });
      },
    });
    const heartbeat = setInterval(() => {
      if (closed) return;
      stream.writeSSE({ event: "heartbeat", data: "" }).catch(() => {
        /* stream closed */
      });
    }, 20_000);
    await stream.writeSSE({ event: "hello", data: JSON.stringify({ userId }) });
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        closed = true;
        clearInterval(heartbeat);
        unregister();
        resolve();
      });
    });
  });
});

export default app;
