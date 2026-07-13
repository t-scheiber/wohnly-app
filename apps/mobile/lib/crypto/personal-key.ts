import { api, apiPost } from "@/lib/api/client";
import { getDeviceKeys } from "./device-storage";
import { generatePersonalKey } from "./keys";
import {
  base64ToSealed,
  openSealedHK,
  sealedToBase64,
  sealToDevice,
} from "./seal";
import {
  cachePersonalKey,
  getCachedPersonalKey,
  loadPersonalKeyFromStorage,
} from "./personal-key-cache";

export interface PersonalKeyState {
  userId: string;
  currentEpoch: number;
  initialized: boolean;
  devices: {
    id: string;
    publicKey: string;
    hasEnvelope: boolean;
  }[];
}

export async function getPersonalKeyState(): Promise<PersonalKeyState> {
  return api<PersonalKeyState>("/api/personal-keys/state");
}

export async function fetchAndCachePersonalKey(
  state?: PersonalKeyState,
): Promise<Uint8Array | null> {
  const keyState = state ?? (await getPersonalKeyState());
  const device = await getDeviceKeys();
  if (!device?.deviceId) return null;
  const ownDevice = keyState.devices.find((item) => item.id === device.deviceId);
  if (!ownDevice?.hasEnvelope) return null;

  try {
    const response = await api<{
      envelope: { sealedKey: string; keyEpoch: number };
    }>(
      `/api/personal-keys/envelopes/${device.deviceId}/${keyState.currentEpoch}`,
    );
    const sealed = await base64ToSealed(response.envelope.sealedKey);
    const key = await openSealedHK(
      sealed,
      device.publicKey,
      device.privateKey,
    );
    cachePersonalKey(keyState.userId, response.envelope.keyEpoch, key);
    return key;
  } catch {
    return null;
  }
}

/** Resolve or safely initialize the current user's personal data key. */
export async function resolvePersonalEncryptionKey(): Promise<{
  key: Uint8Array;
  epoch: number;
  userId: string;
}> {
  let state = await getPersonalKeyState();
  const epoch = state.currentEpoch;
  const cached =
    getCachedPersonalKey(state.userId, epoch) ??
    (await loadPersonalKeyFromStorage(state.userId, epoch));
  if (cached) return { key: cached, epoch, userId: state.userId };

  const fetched = await fetchAndCachePersonalKey(state);
  if (fetched) return { key: fetched, epoch, userId: state.userId };

  const device = await getDeviceKeys();
  const approvedDevice = device?.deviceId
    ? state.devices.find((item) => item.id === device.deviceId)
    : undefined;
  if (!device?.deviceId || !approvedDevice) {
    throw new PersonalEncryptionKeyMissingError(
      "This device must be approved before personal items can be encrypted.",
    );
  }

  if (!state.initialized) {
    const key = await generatePersonalKey();
    const sealedKey = await sealedToBase64(
      await sealToDevice(key, device.publicKey),
    );
    try {
      await apiPost("/api/personal-keys/bootstrap", {
        deviceId: device.deviceId,
        sealedKey,
        keyEpoch: epoch,
      });
      cachePersonalKey(state.userId, epoch, key);
      return { key, epoch, userId: state.userId };
    } catch {
      // Another device may have initialized concurrently. Refetch and use its
      // envelope if it was already distributed to this device.
      state = await getPersonalKeyState();
      const racedKey = await fetchAndCachePersonalKey(state);
      if (racedKey) {
        return {
          key: racedKey,
          epoch: state.currentEpoch,
          userId: state.userId,
        };
      }
    }
  }

  throw new PersonalEncryptionKeyMissingError();
}

export class PersonalEncryptionKeyMissingError extends Error {
  constructor(
    message = "Your personal encryption key is waiting for approval from another device.",
  ) {
    super(message);
    this.name = "PersonalEncryptionKeyMissingError";
  }
}
