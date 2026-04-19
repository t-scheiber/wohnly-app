import type { Context, Next } from "hono";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types.js";

export function requireOwner(
  getHouseholdId: (c: Context<AppEnv>) => string | Promise<string>,
) {
  return async (c: Context<AppEnv>, next: Next) => {
    const userId = c.get("userId");
    const householdId = await getHouseholdId(c);
    const member = await prisma.householdMember.findUnique({
      where: { userId_householdId: { userId, householdId } },
      select: { role: true },
    });
    if (!member) return c.json({ error: "Not a member" }, 403);
    if (member.role !== "OWNER") return c.json({ error: "Owner role required" }, 403);
    await next();
  };
}
