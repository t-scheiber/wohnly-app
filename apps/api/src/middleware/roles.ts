/**
 * Role-based authorization middleware.
 *
 * Usage in route:
 *   app.delete("/", requireRole("admin"), async (c) => { ... });
 */

import type { Context, Next } from "hono";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

export function requireRole(...allowedRoles: string[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const member = await prisma.householdMember.findFirst({ where: { userId } });
    if (!member) return c.json({ error: "No household" }, 400);

    if (!allowedRoles.includes(member.role)) {
      return c.json({ error: `Requires ${allowedRoles.join(" or ")} role` }, 403);
    }

    await next();
  };
}
