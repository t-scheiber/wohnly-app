/**
 * Key generation for E2EE.
 * Ported from haushoit/lib/crypto/keys.ts.
 */

let sodium: typeof import("react-native-libsodium") | null = null;

async function ensureSodium() {
  if (sodium) return sodium;
  const mod = await import("react-native-libsodium");
  await mod.ready;
  sodium = mod;
  return mod;
}

/**
 * Generate an X25519 device keypair.
 * The private key NEVER leaves the device.
 */
export async function generateDeviceKeys(): Promise<{
  publicKey: string; // base64
  privateKey: Uint8Array;
}> {
  const s = await ensureSodium();
  const keypair = s.crypto_box_keypair();
  return {
    publicKey: s.to_base64(keypair.publicKey),
    privateKey: keypair.privateKey,
  };
}

/**
 * Generate a random 32-byte symmetric key for household encryption.
 * Used with XChaCha20-Poly1305.
 */
export async function generateHouseholdKey(): Promise<Uint8Array> {
  const s = await ensureSodium();
  return s.crypto_aead_xchacha20poly1305_ietf_keygen();
}
