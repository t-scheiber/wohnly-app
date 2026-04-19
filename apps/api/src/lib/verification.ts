import { randomInt, createHash, timingSafeEqual } from "node:crypto";

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashCode(code: string, requestId: string): string {
  return createHash("sha256").update(`${code}:${requestId}`).digest("hex");
}

export function compareCode(
  submitted: string,
  storedHash: string,
  requestId: string,
): boolean {
  const submittedHash = hashCode(submitted, requestId);
  const a = Buffer.from(submittedHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
