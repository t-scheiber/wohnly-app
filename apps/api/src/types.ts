/**
 * Shared Hono environment type for authenticated routes.
 * The auth middleware sets "session", "userId", and "user" on the context.
 */
export type AppEnv = {
  Variables: {
    session: { user: { id: string; name: string; email: string } };
    userId: string;
    user: { id: string; name: string; email: string };
  };
};
