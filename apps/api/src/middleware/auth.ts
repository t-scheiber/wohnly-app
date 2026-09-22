import type { Context, Next } from "hono";
import { auth } from "../auth.js";

export async function requireAuth(c: Context, next: Next) {
  const { response: session, headers } = await auth.api.getSession({
    returnHeaders: true,
    headers: c.req.raw.headers,
  });

  for (const cookie of headers.getSetCookie()) c.header("Set-Cookie", cookie, { append: true });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("session", session);
  c.set("userId", session.user.id);
  c.set("user", session.user);

  await next();
}
