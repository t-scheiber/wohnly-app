import assert from "node:assert/strict";
import { test } from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { auth as productionAuth } from "../src/auth.js";

test("production session policy persists for 90 days, renews, and honors sign-out", async () => {
  const db: Record<string, any[]> = { user: [], session: [], account: [], verification: [] };
  const auth = betterAuth({
    ...productionAuth.options,
    baseURL: "https://api.test.example",
    secret: "test-secret-at-least-thirty-two-characters",
    database: memoryAdapter(db),
    socialProviders: {},
    plugins: [],
    emailAndPassword: { enabled: true },
  });
  const signup = await auth.api.signUpEmail({
    body: { email: "session-test@example.com", password: "test-password-12345", name: "Session test" },
    asResponse: true,
  });
  assert.equal(signup.status, 200);
  const cookies = signup.headers.getSetCookie();
  const sessionCookie = cookies.find(c => c.includes("session_token="))!;
  assert.match(sessionCookie, /Max-Age=7776000/i);
  const cookie = sessionCookie.split(";")[0];
  const lifetimeDays = (new Date(db.session[0].expiresAt).getTime() - Date.now()) / 86400000;
  assert.ok(lifetimeDays > 89.99 && lifetimeDays <= 90);

  // Simulate reopening after two days. Both DB expiry and device cookie renew.
  db.session[0].updatedAt = new Date(Date.now() - 2 * 86400000);
  db.session[0].expiresAt = new Date(Date.now() + 88 * 86400000);
  const request = () => new Request("https://api.test.example/api/auth/get-session", { headers: { cookie } });
  const refreshed = await auth.handler(request());
  assert.equal(refreshed.status, 200);
  assert.ok((await refreshed.json()).session);
  assert.match(refreshed.headers.get("set-cookie")!, /Max-Age=7776000/i);
  assert.ok(new Date(db.session[0].expiresAt).getTime() > Date.now() + 89.99 * 86400000);

  const signedOut = await auth.handler(new Request("https://api.test.example/api/auth/sign-out", {
    method: "POST", headers: { cookie, origin: "https://api.test.example" },
  }));
  assert.equal(signedOut.status, 200);
  assert.equal(await (await auth.handler(request())).json(), null);
});
