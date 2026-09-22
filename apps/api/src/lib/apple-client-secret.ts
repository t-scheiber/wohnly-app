import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const VALIDITY_SECONDS = 60 * 60;
const REFRESH_MARGIN_SECONDS = 5 * 60;

/** Apple requires a signed JWT as its OAuth client secret. Renew it on use. */
export function createAppleClientSecretProvider(
  env: NodeJS.ProcessEnv = process.env,
  now: () => number = Date.now,
): () => string {
  const pem = env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n") ||
    (env.APPLE_PRIVATE_KEY_PATH
      ? readFileSync(env.APPLE_PRIVATE_KEY_PATH, "utf8")
      : undefined);

  // Keep existing deployments compatible until their signing key is provisioned.
  if (!pem) return () => env.APPLE_CLIENT_SECRET ?? "";

  const key = createPrivateKey(pem);
  if (key.asymmetricKeyType !== "ec" ||
      key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    throw new Error("Apple Sign-In requires an ES256 P-256 private key");
  }
  for (const name of ["APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_CLIENT_ID"]) {
    if (!env[name]) throw new Error(`${name} is required with an Apple signing key`);
  }

  let cached = "";
  let expiresAt = 0;
  return () => {
    const issuedAt = Math.floor(now() / 1000);
    if (cached && issuedAt < expiresAt - REFRESH_MARGIN_SECONDS) return cached;

    const expires = issuedAt + VALIDITY_SECONDS;
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const input = `${encode({ alg: "ES256", kid: env.APPLE_KEY_ID, typ: "JWT" })}.${encode({
      iss: env.APPLE_TEAM_ID,
      iat: issuedAt,
      exp: expires,
      aud: "https://appleid.apple.com",
      sub: env.APPLE_CLIENT_ID,
    })}`;
    // JWT ES256 requires the 64-byte R || S format, not Node's default DER.
    const signature = sign("sha256", Buffer.from(input), {
      key,
      dsaEncoding: "ieee-p1363",
    }).toString("base64url");
    cached = `${input}.${signature}`;
    expiresAt = expires;
    return cached;
  };
}
