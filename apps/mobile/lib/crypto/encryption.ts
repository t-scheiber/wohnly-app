/**
 * Client-side E2EE using XChaCha20-Poly1305.
 * Uses platform-aware sodium loader (native: react-native-libsodium, web: libsodium-wrappers).
 */
import { getSodium } from "./sodium";

/**
 * Encrypt plaintext with a household key using XChaCha20-Poly1305.
 * Returns { cipher, nonce } as base64 strings.
 */
export async function encryptData(
  plaintext: string,
  householdKey: Uint8Array,
  associatedData?: string
): Promise<{ cipher: string; nonce: string }> {
  const s = await getSodium();

  if (householdKey.length !== s.crypto_aead_xchacha20poly1305_ietf_KEYBYTES) {
    throw new Error(`Invalid key length: expected ${s.crypto_aead_xchacha20poly1305_ietf_KEYBYTES}, got ${householdKey.length}`);
  }

  const nonce = s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const message = new TextEncoder().encode(plaintext);
  const ad = associatedData ? new TextEncoder().encode(associatedData) : null;

  const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    message,
    ad,
    null, // nsec (not used)
    nonce,
    householdKey
  );

  return {
    cipher: s.to_base64(ciphertext),
    nonce: s.to_base64(nonce),
  };
}

/**
 * Decrypt ciphertext with a household key.
 * Returns the plaintext string.
 */
export async function decryptData(
  cipherBase64: string,
  nonceBase64: string,
  householdKey: Uint8Array,
  associatedData?: string
): Promise<string> {
  const s = await getSodium();

  const ciphertext = s.from_base64(cipherBase64);
  const nonce = s.from_base64(nonceBase64);
  const ad = associatedData ? new TextEncoder().encode(associatedData) : null;

  try {
    const decrypted = s.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null, // nsec
      ciphertext,
      ad,
      nonce,
      householdKey
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error("Decryption failed: incorrect key or corrupted data");
  }
}
