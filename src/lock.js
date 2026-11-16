// Password lock: turns a password into an encryption key and scrambles saved data with it.
//
// Uses the browser's built-in Web Crypto: PBKDF2 (SHA-256, 600,000 rounds) turns the password
// into a 256-bit AES-GCM key. The password and key are never saved; only a random "salt" and a
// small encrypted check value are, so a wrong password can be told apart from a right one.

export const LOCK_KEY = 'stride-talent-workspace:lock:v1';
export const MIN_PASSWORD_LENGTH = 8;
export const AUTO_LOCK_OPTIONS = [
  [5, 'After 5 minutes away'],
  [15, 'After 15 minutes away'],
  [30, 'After 30 minutes away'],
  [60, 'After 1 hour away'],
  [0, 'Never (only when I lock it)'],
];

const ITERATIONS = 600_000;
const CHECK_TEXT = 'stride-talent-workspace';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** Saved lock settings, or null when no password is set. */
export function lockConfig() {
  try {
    const config = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null');
    return config && config.v === 1 && config.salt && isEncrypted(config.check) ? config : null;
  } catch {
    return null;
  }
}

export const isEncrypted = (value) => !!value && value.enc === 'aes-gcm' && typeof value.iv === 'string' && typeof value.ct === 'string';

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text));
  return { enc: 'aes-gcm', iv: toBase64(iv), ct: toBase64(ct) };
}

export async function decryptText(key, box) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(box.iv) }, key, fromBase64(box.ct));
  return decoder.decode(plain);
}

/** Returns a problem with a new password, or null when it's fine. */
export function checkNewPassword(password, confirmation) {
  if (String(password).length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirmation) return 'The two passwords don’t match.';
  return null;
}

/** Makes lock settings and a key for a new password. Nothing is saved here. */
export async function createLock(password, { hint = '', autoLockMinutes = 15 } = {}) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt, ITERATIONS);
  const config = {
    v: 1,
    salt: toBase64(salt),
    iterations: ITERATIONS,
    check: await encryptText(key, CHECK_TEXT),
    hint: String(hint || '').trim(),
    autoLockMinutes: Number(autoLockMinutes) || 0,
    createdAt: new Date().toISOString(),
  };
  return { config, key };
}

/** The key for this password, or null when the password is wrong. */
export async function keyFor(password, config = lockConfig()) {
  if (!config) return null;
  const key = await deriveKey(password, fromBase64(config.salt), config.iterations || ITERATIONS);
  try {
    return (await decryptText(key, config.check)) === CHECK_TEXT ? key : null;
  } catch {
    return null; // wrong password: AES-GCM refuses to decrypt
  }
}
