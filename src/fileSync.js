// Keeps the browser's copy of the workspace and the file on this computer in step.
//
// On start: loads everything from the file (the file is the source of truth). If the file is
// still empty, the browser's data is copied into it. After that, every change the app saves
// in the browser is also sent to the file a moment later.
// If the file can't be reached (e.g. the page was opened some other way), the workspace still
// works, saving in the browser only, and the Backup window says so.

const PREFIX = 'stride-talent-workspace:';
const SKIP = new Set(['stride-talent-workspace:reminders-shown:v1']); // short-lived, not worth saving
const WORKSPACE_KEY = 'stride-talent-workspace:v1';
const ENDPOINT = '__workspace/storage';
const HEADERS = { 'Content-Type': 'application/json', 'X-Stride-Workspace': '1' };

let status = { mode: 'starting', path: '', lastSavedAt: null, error: '' };
const listeners = new Set();
export const getFileStatus = () => status;
export const onFileStatus = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const setStatus = (patch) => {
  status = { ...status, ...patch };
  listeners.forEach((fn) => fn(status));
};

const tracked = (key) => typeof key === 'string' && key.startsWith(PREFIX) && !SKIP.has(key);
const trackedKeys = () => Object.keys(localStorage).filter(tracked);

const pending = new Map();
let timer = null;

async function flush({ keepalive = false } = {}) {
  clearTimeout(timer);
  if (!pending.size) return;
  const changes = Object.fromEntries(pending);
  pending.clear();
  try {
    const res = await fetch(ENDPOINT, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ changes }), keepalive });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
    const body = await res.json();
    setStatus({ lastSavedAt: body.savedAt, error: '' });
  } catch {
    // keep the changes (unless something newer replaced them) and try again shortly
    Object.entries(changes).forEach(([key, value]) => !pending.has(key) && pending.set(key, value));
    setStatus({ error: 'Your latest changes couldn’t be saved to the file. Keep the workspace open; it will keep trying.' });
    timer = setTimeout(flush, 5000);
  }
}

function queue(key, value) {
  pending.set(key, value);
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}

/** Every time the app saves something in the browser, send it to the file too. */
function watchBrowserStorage() {
  const proto = Storage.prototype;
  const setItem = proto.setItem;
  const removeItem = proto.removeItem;
  proto.setItem = function patchedSetItem(key, value) {
    setItem.call(this, key, value);
    if (this === window.localStorage && tracked(key)) queue(key, String(value));
  };
  proto.removeItem = function patchedRemoveItem(key) {
    removeItem.call(this, key);
    if (this === window.localStorage && tracked(key)) queue(key, null);
  };
  window.addEventListener('pagehide', () => flush({ keepalive: true }));
}

/** Call once before the app starts. Never throws. */
export async function startFileSync() {
  let remote;
  try {
    const res = await fetch(ENDPOINT, { headers: HEADERS, cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    remote = await res.json();
  } catch {
    setStatus({ mode: 'browser-only' });
    return;
  }

  const fileData = remote.data && typeof remote.data === 'object' ? remote.data : {};
  try {
    if (Object.keys(fileData).length) {
      // The file wins. If this browser has different workspace data, keep a copy of it first.
      const local = localStorage.getItem(WORKSPACE_KEY);
      if (local && local !== fileData[WORKSPACE_KEY]) {
        const snapshot = Object.fromEntries(trackedKeys().map((key) => [key, localStorage.getItem(key)]));
        await fetch('__workspace/browser-copy', { method: 'POST', headers: HEADERS, body: JSON.stringify({ data: snapshot }) });
      }
      trackedKeys().forEach((key) => !(key in fileData) && localStorage.removeItem(key));
      Object.entries(fileData).forEach(([key, value]) => tracked(key) && typeof value === 'string' && localStorage.setItem(key, value));
    } else if (trackedKeys().length) {
      // First run: copy what this browser already has into the file.
      trackedKeys().forEach((key) => pending.set(key, localStorage.getItem(key)));
      await flush();
    }
  } catch {
    // If anything went wrong, carry on with the browser's copy rather than block the app.
  }
  watchBrowserStorage();
  setStatus({ mode: 'file', path: remote.path, lastSavedAt: status.lastSavedAt || remote.savedAt, error: remote.warning || status.error });
}
