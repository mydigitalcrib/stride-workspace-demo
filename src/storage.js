// Where the workspace keeps its data.
//
// This copy stores everything in the browser (localStorage), so it runs anywhere
// as a static site with no server. Data stays in the browser it was entered in.
// To share data across devices or teammates, replace these functions with
// calls to a backend; the rest of the app only talks to this file.
//
// When a password is set (see lock.js), the workspace data and the restore safety copy are
// encrypted before they're saved. The key only lives in memory while the workspace is unlocked.

import { LOCK_KEY, createLock, decryptText, encryptText, isEncrypted, keyFor, lockConfig } from './lock.js';

export const WORKSPACE_KEY = 'stride-talent-workspace:v1';
/** What was here before the last restore, so the restore can be undone. */
export const SAFETY_COPY_KEY = 'stride-talent-workspace:before-restore:v1';
/** Keys that hold creator and calendar data, and get encrypted when a password is set. */
const PRIVATE_KEYS = [WORKSPACE_KEY, SAFETY_COPY_KEY];

let sessionKey = null; // the encryption key, while unlocked
const unlocked = new Map(); // decrypted copies of PRIVATE_KEYS, while unlocked

const parse = (text) => {
  try {
    return JSON.parse(text || 'null');
  } catch {
    return null;
  }
};

export const isLocked = () => !!lockConfig() && !sessionKey;

/** Reads private data (creators, calendar…). Only works while unlocked. */
export function readPrivate(key) {
  if (!lockConfig()) return parse(localStorage.getItem(key));
  if (!sessionKey) throw new Error('The workspace is locked.');
  return unlocked.has(key) ? structuredClone(unlocked.get(key)) : null;
}

/** Saves private data, encrypting it when a password is set. `null` removes it. */
export async function writePrivate(key, value) {
  if (value == null) {
    localStorage.removeItem(key);
    unlocked.delete(key);
    return;
  }
  if (lockConfig()) {
    if (!sessionKey) throw new Error('The workspace is locked.');
    localStorage.setItem(key, JSON.stringify(await encryptText(sessionKey, JSON.stringify(value))));
    unlocked.set(key, structuredClone(value));
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

/** Writes several keys at once; if any write fails, puts every key back the way it was. */
function commit(entries) {
  const before = entries.map(([key]) => [key, localStorage.getItem(key)]);
  try {
    entries.forEach(([key, text]) => (text == null ? localStorage.removeItem(key) : localStorage.setItem(key, text)));
  } catch {
    before.forEach(([key, text]) => {
      try {
        if (text == null) localStorage.removeItem(key);
        else localStorage.setItem(key, text);
      } catch {
        /* best effort */
      }
    });
    throw new Error('There isn’t enough room in this browser to do that. Nothing was changed.');
  }
}

async function encryptAll(key, values) {
  const entries = [];
  for (const [name, value] of values) entries.push([name, value == null ? null : JSON.stringify(await encryptText(key, JSON.stringify(value)))]);
  return entries;
}

/** Tries a password. On success, decrypts the private data into memory and returns true. */
export async function unlock(password) {
  const key = await keyFor(password);
  if (!key) return false;
  const values = new Map();
  for (const name of PRIVATE_KEYS) {
    const stored = parse(localStorage.getItem(name));
    if (stored == null) continue;
    values.set(name, isEncrypted(stored) ? JSON.parse(await decryptText(key, stored)) : stored);
  }
  sessionKey = key;
  unlocked.clear();
  values.forEach((value, name) => unlocked.set(name, value));
  // anything that was somehow still unencrypted gets encrypted now
  for (const name of PRIVATE_KEYS) {
    if (values.has(name) && !isEncrypted(parse(localStorage.getItem(name)))) await writePrivate(name, values.get(name));
  }
  return true;
}

/** Forgets the key and the decrypted data (used when locking). */
export function forgetKey() {
  sessionKey = null;
  unlocked.clear();
}

/** Turns on the password: encrypts everything that's saved now. */
export async function enablePassword(password, options) {
  if (lockConfig()) throw new Error('A password is already set.');
  const current = PRIVATE_KEYS.map((name) => [name, parse(localStorage.getItem(name))]);
  const { config, key } = await createLock(password, options);
  commit([[LOCK_KEY, JSON.stringify(config)], ...(await encryptAll(key, current))]);
  sessionKey = key;
  unlocked.clear();
  current.forEach(([name, value]) => value != null && unlocked.set(name, value));
}

/** Changes the password. Everything is re-encrypted with the new one. */
export async function changePassword(currentPassword, newPassword, options) {
  const config = lockConfig();
  if (!config || !(await keyFor(currentPassword, config))) return false;
  const values = PRIVATE_KEYS.map((name) => [name, unlocked.has(name) ? unlocked.get(name) : null]);
  const next = await createLock(newPassword, { hint: config.hint, autoLockMinutes: config.autoLockMinutes, ...options });
  commit([[LOCK_KEY, JSON.stringify(next.config)], ...(await encryptAll(next.key, values))]);
  sessionKey = next.key;
  return true;
}

/** Turns the password off: saves everything unencrypted again. */
export async function disablePassword(currentPassword) {
  const config = lockConfig();
  if (!config || !(await keyFor(currentPassword, config))) return false;
  commit([[LOCK_KEY, null], ...PRIVATE_KEYS.map((name) => [name, unlocked.has(name) ? JSON.stringify(unlocked.get(name)) : null])]);
  forgetKey();
  return true;
}

/** Updates the hint or auto-lock time (doesn't need the password). */
export function updateLockSettings(changes) {
  const config = lockConfig();
  if (!config) return;
  localStorage.setItem(LOCK_KEY, JSON.stringify({ ...config, ...changes }));
}

/** For a forgotten password: deletes the encrypted data and the password, so you can start over. */
export function eraseLockedWorkspace() {
  [...PRIVATE_KEYS, LOCK_KEY].forEach((name) => localStorage.removeItem(name));
  forgetKey();
}

// ---- creators, templates and calendar items ----

function read() {
  const data = readPrivate(WORKSPACE_KEY);
  return {
    creators: Array.isArray(data?.creators) ? data.creators : [],
    templates: Array.isArray(data?.templates) ? data.templates : [],
    events: Array.isArray(data?.events) ? data.events : [],
  };
}

async function write(data) {
  try {
    await writePrivate(WORKSPACE_KEY, data);
  } catch (err) {
    if (err.message === 'The workspace is locked.') throw err;
    throw new Error('Couldn’t save. This browser is blocking storage (private window?) or is out of space.');
  }
}

const LISTS = { creator: 'creators', template: 'templates', event: 'events' };

/** Returns { creators, templates, events }. */
export async function loadWorkspace() {
  return read();
}

/** Adds or replaces one record. kind is 'creator', 'template' or 'event'. */
export async function saveRecord(kind, record) {
  const data = read();
  const list = data[LISTS[kind]];
  const index = list.findIndex((item) => item.id === record.id);
  if (index >= 0) list[index] = record;
  else if (kind === 'creator') list.unshift(record);
  else list.push(record);
  await write(data);
}

/** Adds several creators in one write, so an import either fully saves or doesn't. */
export async function addCreators(records) {
  const data = read();
  data.creators = [...records, ...data.creators];
  await write(data);
}

/** Adds new creators and replaces updated ones (matched by id) in one write. */
export async function saveImport(added, updated) {
  const data = read();
  const byId = new Map(updated.map((record) => [record.id, record]));
  data.creators = [...added, ...data.creators.map((c) => byId.get(c.id) || c)];
  await write(data);
}

export async function deleteCreator(id) {
  const data = read();
  data.creators = data.creators.filter((c) => c.id !== id);
  await write(data);
}

export async function deleteEvent(id) {
  const data = read();
  data.events = data.events.filter((e) => e.id !== id);
  await write(data);
}
