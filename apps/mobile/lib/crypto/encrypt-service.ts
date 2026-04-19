/**
 * Field-level encryption service for each data type.
 *
 * Each encrypt function bundles sensitive fields into a JSON string, encrypts
 * with one encryptData call, and stamps the row with the `encryptionEpoch` the
 * key belongs to so later decryption can look up the right key after rotation.
 *
 * Each decrypt function checks the encrypted flag, decrypts the primary field,
 * parses the JSON payload, and merges the sensitive fields back.
 */
import { encryptData, decryptData } from "./encryption";

// ── Todos ──

export async function encryptTodo(
  data: { title: string; description?: string | null },
  hk: Uint8Array,
  epoch: number
): Promise<{ title: string; description: null; nonce: string; encrypted: true; encryptionEpoch: number }> {
  const payload = JSON.stringify({
    title: data.title,
    description: data.description ?? null,
  });
  const { cipher, nonce } = await encryptData(payload, hk);
  return { title: cipher, description: null, nonce, encrypted: true, encryptionEpoch: epoch };
}

export async function decryptTodo<T extends { title: string; description?: string | null; encrypted?: boolean; nonce?: string | null }>(
  todo: T,
  hk: Uint8Array
): Promise<T> {
  if (!todo.encrypted || !todo.nonce) return todo;
  const decrypted = await decryptData(todo.title, todo.nonce, hk);
  const parsed = JSON.parse(decrypted);
  return { ...todo, title: parsed.title, description: parsed.description };
}

// ── Shopping Items ──

export async function encryptShoppingItem(
  data: { name: string; quantity?: string | null },
  hk: Uint8Array,
  epoch: number
): Promise<{ name: string; quantity: null; nonce: string; encrypted: true; encryptionEpoch: number }> {
  const payload = JSON.stringify({
    name: data.name,
    quantity: data.quantity ?? null,
  });
  const { cipher, nonce } = await encryptData(payload, hk);
  return { name: cipher, quantity: null, nonce, encrypted: true, encryptionEpoch: epoch };
}

export async function decryptShoppingItem<T extends { name: string; quantity?: string | null; encrypted?: boolean; nonce?: string | null }>(
  item: T,
  hk: Uint8Array
): Promise<T> {
  if (!item.encrypted || !item.nonce) return item;
  const decrypted = await decryptData(item.name, item.nonce, hk);
  const parsed = JSON.parse(decrypted);
  return { ...item, name: parsed.name, quantity: parsed.quantity };
}

// ── Chores ──

export async function encryptChore(
  data: { title: string; description?: string | null },
  hk: Uint8Array,
  epoch: number
): Promise<{ title: string; description: null; nonce: string; encrypted: true; encryptionEpoch: number }> {
  const payload = JSON.stringify({
    title: data.title,
    description: data.description ?? null,
  });
  const { cipher, nonce } = await encryptData(payload, hk);
  return { title: cipher, description: null, nonce, encrypted: true, encryptionEpoch: epoch };
}

export async function decryptChore<T extends { title: string; description?: string | null; encrypted?: boolean; nonce?: string | null }>(
  chore: T,
  hk: Uint8Array
): Promise<T> {
  if (!chore.encrypted || !chore.nonce) return chore;
  const decrypted = await decryptData(chore.title, chore.nonce, hk);
  const parsed = JSON.parse(decrypted);
  return { ...chore, title: parsed.title, description: parsed.description };
}

// ── Events ──

export async function encryptEvent(
  data: { title: string; description?: string | null; location?: string | null },
  hk: Uint8Array,
  epoch: number
): Promise<{ title: string; description: null; location: null; nonce: string; encrypted: true; encryptionEpoch: number }> {
  const payload = JSON.stringify({
    title: data.title,
    description: data.description ?? null,
    location: data.location ?? null,
  });
  const { cipher, nonce } = await encryptData(payload, hk);
  return { title: cipher, description: null, location: null, nonce, encrypted: true, encryptionEpoch: epoch };
}

export async function decryptEvent<T extends { title: string; description?: string | null; location?: string | null; encrypted?: boolean; nonce?: string | null }>(
  event: T,
  hk: Uint8Array
): Promise<T> {
  if (!event.encrypted || !event.nonce) return event;
  const decrypted = await decryptData(event.title, event.nonce, hk);
  const parsed = JSON.parse(decrypted);
  return { ...event, title: parsed.title, description: parsed.description, location: parsed.location };
}

// ── Expenses ──
// Note: amount stays plaintext for server-side balance computation

export async function encryptExpense(
  data: { title: string; description?: string | null },
  hk: Uint8Array,
  epoch: number
): Promise<{ title: string; description: null; nonce: string; encrypted: true; encryptionEpoch: number }> {
  const payload = JSON.stringify({
    title: data.title,
    description: data.description ?? null,
  });
  const { cipher, nonce } = await encryptData(payload, hk);
  return { title: cipher, description: null, nonce, encrypted: true, encryptionEpoch: epoch };
}

export async function decryptExpense<T extends { title: string; description?: string | null; encrypted?: boolean; nonce?: string | null }>(
  expense: T,
  hk: Uint8Array
): Promise<T> {
  if (!expense.encrypted || !expense.nonce) return expense;
  const decrypted = await decryptData(expense.title, expense.nonce, hk);
  const parsed = JSON.parse(decrypted);
  return { ...expense, title: parsed.title, description: parsed.description };
}

// ── Expense Attachments ──
// Encrypts the entire content (note text or base64 photo) as one blob

export async function encryptAttachment(
  content: string,
  hk: Uint8Array,
  epoch: number
): Promise<{ content: string; nonce: string; encrypted: true; encryptionEpoch: number }> {
  const { cipher, nonce } = await encryptData(content, hk);
  return { content: cipher, nonce, encrypted: true, encryptionEpoch: epoch };
}

export async function decryptAttachment<T extends { content: string; encrypted?: boolean; nonce?: string | null }>(
  attachment: T,
  hk: Uint8Array
): Promise<T> {
  if (!attachment.encrypted || !attachment.nonce) return attachment;
  const decrypted = await decryptData(attachment.content, attachment.nonce, hk);
  return { ...attachment, content: decrypted };
}

// ── Subscriptions ──
// Note: amount stays plaintext for server-side balance computation

export async function encryptSubscription(
  data: { name: string; description?: string | null },
  hk: Uint8Array,
  epoch: number
): Promise<{ name: string; description: null; nonce: string; encrypted: true; encryptionEpoch: number }> {
  const payload = JSON.stringify({
    name: data.name,
    description: data.description ?? null,
  });
  const { cipher, nonce } = await encryptData(payload, hk);
  return { name: cipher, description: null, nonce, encrypted: true, encryptionEpoch: epoch };
}

export async function decryptSubscription<T extends { name: string; description?: string | null; encrypted?: boolean; nonce?: string | null }>(
  sub: T,
  hk: Uint8Array
): Promise<T> {
  if (!sub.encrypted || !sub.nonce) return sub;
  const decrypted = await decryptData(sub.name, sub.nonce, hk);
  const parsed = JSON.parse(decrypted);
  return { ...sub, name: parsed.name, description: parsed.description };
}
