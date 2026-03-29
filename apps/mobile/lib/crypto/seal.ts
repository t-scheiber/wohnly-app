/**
 * Key sealing/unsealing for E2EE key distribution.
 * Uses crypto_box_seal to encrypt the household key
 * to a specific device's X25519 public key.
 */
import { getSodium } from "./sodium";

/**
 * Seal (encrypt) a household key to a device's public key.
 * Only the holder of the matching private key can unseal it.
 */
export async function sealToDevice(
  householdKey: Uint8Array,
  devicePublicKeyBase64: string
): Promise<Uint8Array> {
  const s = await getSodium();
  const publicKey = s.from_base64(devicePublicKeyBase64);
  return s.crypto_box_seal(householdKey, publicKey);
}

/**
 * Unseal (decrypt) a sealed household key using the device's keypair.
 */
export async function openSealedHK(
  sealed: Uint8Array,
  devicePublicKeyBase64: string,
  devicePrivateKey: Uint8Array
): Promise<Uint8Array> {
  const s = await getSodium();
  const publicKey = s.from_base64(devicePublicKeyBase64);
  return s.crypto_box_seal_open(sealed, publicKey, devicePrivateKey);
}

/**
 * Convert a sealed key to base64 for storage/transmission.
 */
export async function sealedToBase64(sealed: Uint8Array): Promise<string> {
  const s = await getSodium();
  return s.to_base64(sealed);
}

/**
 * Convert a base64 string back to a sealed key.
 */
export async function base64ToSealed(base64: string): Promise<Uint8Array> {
  const s = await getSodium();
  return s.from_base64(base64);
}
