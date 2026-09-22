import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { test } from "node:test";
import { createAppleClientSecretProvider } from "../src/lib/apple-client-secret.js";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const env = {
  APPLE_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  APPLE_TEAM_ID: "test-team",
  APPLE_KEY_ID: "test-key",
  APPLE_CLIENT_ID: "app.test.web",
};

test("signs a valid ES256 JWT and renews it before expiry without restarting", () => {
  let now = Date.UTC(2026, 8, 22);
  const getSecret = createAppleClientSecretProvider(env, () => now);
  const first = getSecret();
  const [header, payload, signature] = first.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), {
    alg: "ES256", kid: "test-key", typ: "JWT",
  });
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  assert.equal(claims.iss, env.APPLE_TEAM_ID);
  assert.equal(claims.sub, env.APPLE_CLIENT_ID);
  assert.equal(claims.aud, "https://appleid.apple.com");
  assert.equal(claims.exp - claims.iat, 3600);
  assert.equal(Buffer.from(signature, "base64url").length, 64);
  assert.ok(verify("sha256", Buffer.from(`${header}.${payload}`), {
    key: publicKey, dsaEncoding: "ieee-p1363",
  }, Buffer.from(signature, "base64url")));
  now += 54 * 60 * 1000;
  assert.equal(getSecret(), first);
  now += 60 * 1000;
  const renewed = getSecret();
  assert.notEqual(renewed, first);
  assert.equal(JSON.parse(Buffer.from(renewed.split(".")[1], "base64url").toString()).iat, now / 1000);
});

test("supports escaped PEM environment variables and legacy static secrets", () => {
  assert.ok(createAppleClientSecretProvider({ ...env,
    APPLE_PRIVATE_KEY: env.APPLE_PRIVATE_KEY.replace(/\n/g, "\\n"),
  })());
  assert.equal(createAppleClientSecretProvider({ APPLE_CLIENT_SECRET: "legacy" })(), "legacy");
});

test("fails on incomplete signing configuration", () => {
  assert.throws(() => createAppleClientSecretProvider({ ...env, APPLE_KEY_ID: "" }), /APPLE_KEY_ID/);
});

test("Better Auth reads the renewed credential when exchanging an Apple code", async (t) => {
  let now = Date.UTC(2026, 8, 22);
  const getSecret = createAppleClientSecretProvider(env, () => now);
  const sentSecrets: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    sentSecrets.push(new URLSearchParams(String(options.body)).get("client_secret")!);
    return Response.json({ error: "invalid_grant" }, { status: 400 });
  });
  const auth = betterAuth({
    baseURL: "https://api.test.example",
    secret: "test-secret-at-least-thirty-two-characters",
    database: memoryAdapter({}),
    logger: { disabled: true },
    socialProviders: { apple: {
      clientId: env.APPLE_CLIENT_ID,
      get clientSecret() { return getSecret(); },
    } },
  });
  const context = await auth.$context;
  const provider = context.socialProviders.find(p => p.id === "apple")!;
  const exchange = () => provider.validateAuthorizationCode({
    code: "synthetic-code", redirectURI: "https://api.test.example/api/auth/callback/apple",
  }).catch(() => null);
  await exchange();
  now += 60 * 60 * 1000;
  await exchange();
  assert.equal(sentSecrets.length, 2);
  assert.notEqual(sentSecrets[0], sentSecrets[1]);
  assert.equal(sentSecrets[1], getSecret());
});
