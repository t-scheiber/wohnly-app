import type { Context, Next } from "hono";
import type { z } from "zod";

/**
 * Create a Hono middleware that validates the request body against a Zod schema.
 * Attaches the parsed data to c.req.valid("json").
 */
export function zValidator<T extends z.ZodType>(schema: T) {
  return async (c: Context, next: Next) => {
    const body = await c.req.json().catch(() => null);

    if (body === null) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const result = schema.safeParse(body);

    if (!result.success) {
      return c.json(
        {
          error: "Validation failed",
          details: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400
      );
    }

    c.set("validatedBody", result.data);
    await next();
  };
}

/**
 * Get the validated body from the context.
 * Must be used after zValidator middleware.
 */
export function getValidatedBody<T>(c: Context): T {
  return c.get("validatedBody") as T;
}
