// Saves the workspace to a file on this computer, so data survives a cleared or different browser.
//
// The app (in the browser) sends every change here; this writes it to
//   michelle-for-stride/workspace-data/workspace.json
// and keeps one dated copy per day in workspace-data/history (the last 30 days).
// Only this app on this computer can use it: requests must come from localhost and carry
// a custom header that other websites can't send.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const DATA_DIR = process.env.STRIDE_DATA_DIR || path.resolve(APP_ROOT, '..', 'workspace-data');
const FILE = path.join(DATA_DIR, 'workspace.json');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const KEEP_DAYS = 30;
const PREFIX = 'stride-talent-workspace:';
const MAX_BODY = 25 * 1024 * 1024;

function readFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return parsed && typeof parsed.data === 'object' ? parsed : { data: {} };
  } catch (err) {
    if (err.code === 'ENOENT') return { data: {} };
    // A damaged file is kept aside rather than overwritten.
    const aside = `${FILE}.damaged-${Date.now()}`;
    try {
      fs.copyFileSync(FILE, aside);
    } catch {
      /* ignore */
    }
    return { data: {}, warning: `The data file couldn’t be read and was kept as ${path.basename(aside)}.` };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Writes via a temporary file and a rename, so a crash never leaves half a file. Retries if OneDrive has it open. */
async function writeFileSafely(target, text) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp`;
  for (let attempt = 0; ; attempt++) {
    try {
      fs.writeFileSync(temp, text, 'utf8');
      fs.renameSync(temp, target);
      return;
    } catch (err) {
      if (attempt >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
      await sleep(150 * (attempt + 1));
    }
  }
}

function keepDailyCopy() {
  if (!fs.existsSync(FILE)) return;
  const day = new Date().toISOString().slice(0, 10);
  const copy = path.join(HISTORY_DIR, `workspace-${day}.json`);
  if (fs.existsSync(copy)) return;
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  fs.copyFileSync(FILE, copy);
  const old = fs
    .readdirSync(HISTORY_DIR)
    .filter((name) => /^workspace-\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()
    .slice(0, -KEEP_DAYS);
  old.forEach((name) => fs.rmSync(path.join(HISTORY_DIR, name), { force: true }));
}

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Too large'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Only this app, on this computer. */
function allowed(req) {
  if (req.headers['x-stride-workspace'] !== '1') return false; // other websites can't add this header
  const host = String(req.headers.host || '');
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) return false;
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

async function handle(req, res, next) {
  const url = (req.url || '').split('?')[0];
  if (!url.includes('/__workspace/')) return next();
  if (!allowed(req)) return json(res, 403, { error: 'Not allowed' });
  try {
    if (url.endsWith('/__workspace/storage') && req.method === 'GET') {
      const file = readFile();
      return json(res, 200, { path: FILE, savedAt: file.savedAt || null, data: file.data || {}, warning: file.warning || '' });
    }
    if (url.endsWith('/__workspace/storage') && req.method === 'PUT') {
      const { changes } = JSON.parse(await readBody(req));
      if (!changes || typeof changes !== 'object') return json(res, 400, { error: 'Nothing to save' });
      const file = readFile();
      const data = { ...(file.data || {}) };
      for (const [key, value] of Object.entries(changes)) {
        if (!key.startsWith(PREFIX)) continue;
        if (value === null) delete data[key];
        else if (typeof value === 'string') data[key] = value;
      }
      keepDailyCopy();
      const savedAt = new Date().toISOString();
      await writeFileSafely(FILE, JSON.stringify({ app: 'stride-talent-workspace', format: 'browser-storage', version: 1, savedAt, data }, null, 1));
      return json(res, 200, { savedAt, path: FILE });
    }
    if (url.endsWith('/__workspace/browser-copy') && req.method === 'POST') {
      // Before a browser's own (different) data is replaced by the file, keep a copy of it.
      const { data } = JSON.parse(await readBody(req));
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const target = path.join(HISTORY_DIR, `browser-copy-${stamp}.json`);
      await writeFileSafely(target, JSON.stringify({ app: 'stride-talent-workspace', format: 'browser-storage', version: 1, savedAt: new Date().toISOString(), data }, null, 1));
      return json(res, 200, { path: target });
    }
    return json(res, 404, { error: 'Unknown' });
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) });
  }
}

/** Vite plugin: adds the save-to-file endpoints to `npm run dev` and `npm run preview`. */
export function workspaceFileStorage() {
  return {
    name: 'stride-workspace-file',
    configureServer(server) {
      server.middlewares.use(handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle);
    },
  };
}
