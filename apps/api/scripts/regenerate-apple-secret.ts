/**
 * Regenerates the Apple Sign-In client secret JWT.
 * Run monthly via cron to ensure it never expires (6-month validity).
 *
 * Requires APPLE_PRIVATE_KEY env var (or a .p8 file at APPLE_PRIVATE_KEY_PATH).
 *
 * Usage: npx tsx scripts/regenerate-apple-secret.ts
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

const TEAM_ID = process.env.APPLE_TEAM_ID ?? "8RSPLFN63L";
const KEY_ID = process.env.APPLE_KEY_ID ?? "J47C35X5BR";
const CLIENT_ID = process.env.APPLE_CLIENT_ID ?? "app.wohnly.web";

function loadPrivateKey(): string {
  if (process.env.APPLE_PRIVATE_KEY) {
    return process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  const keyPath =
    process.env.APPLE_PRIVATE_KEY_PATH ??
    path.resolve(__dirname, "../AuthKey.p8");
  if (!fs.existsSync(keyPath)) {
    console.error(
      "No Apple private key found. Set APPLE_PRIVATE_KEY env var or place the .p8 file at:",
      keyPath
    );
    process.exit(1);
  }
  return fs.readFileSync(keyPath, "utf-8");
}

function generateAppleClientSecret(): string {
  const privateKey = loadPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 86400 * 180; // 6 months

  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const payload = {
    iss: TEAM_ID,
    iat: now,
    exp,
    aud: "https://appleid.apple.com",
    sub: CLIENT_ID,
  };

  function base64url(obj: object): string {
    return Buffer.from(JSON.stringify(obj)).toString("base64url");
  }

  const headerB64 = base64url(header);
  const payloadB64 = base64url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign("SHA256");
  sign.update(signingInput);
  const signature = sign.sign(privateKey, "base64url");

  return `${signingInput}.${signature}`;
}

// Generate new secret
const secret = generateAppleClientSecret();
console.log("New Apple client secret generated.");
console.log(`Expires: ${new Date((Math.floor(Date.now() / 1000) + 86400 * 180) * 1000).toISOString()}`);

// Update .env file
const envPath = path.resolve(__dirname, "../.env");
let envContent = fs.readFileSync(envPath, "utf-8");

envContent = envContent.replace(
  /APPLE_CLIENT_SECRET=.*/,
  `APPLE_CLIENT_SECRET=${secret}`
);

fs.writeFileSync(envPath, envContent);
console.log(".env updated.");
console.log("Restart the API: pm2 restart wohnly-api");
