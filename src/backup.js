// Back up & restore: one file with everything this browser has saved for the workspace.
import { APPEARANCE_KEY } from './appearance.js';
import { CALENDAR_PREFS_KEY } from './calendar.js';
import { SAFETY_COPY_KEY, WORKSPACE_KEY, readPrivate, writePrivate } from './storage.js';

export const BACKUP_APP = 'stride-talent-workspace';
export const BACKUP_VERSION = 1;
const LAST_BACKUP_KEY = 'stride-talent-workspace:last-backup:v1';
/** Suggest a backup when there's data and the last one is older than this. */
export const BACKUP_EVERY_DAYS = 7;

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};
const list = (value) => (Array.isArray(value) ? value : []);
const objectOrNull = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);

/**
 * Everything saved for the workspace in this browser (real data, never the sample preview).
 * Backup files are not password-protected, so they can rescue a forgotten password.
 */
export function collectBackup(now = new Date()) {
  const workspace = readPrivate(WORKSPACE_KEY) || {};
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    workspace: { creators: list(workspace.creators), templates: list(workspace.templates), events: list(workspace.events) },
    appearance: objectOrNull(readJson(APPEARANCE_KEY)),
    calendarPrefs: objectOrNull(readJson(CALENDAR_PREFS_KEY)),
  };
}

export const countsOf = (backup) => ({
  creators: backup.workspace.creators.length,
  events: backup.workspace.events.length,
  templates: backup.workspace.templates.length,
  look: !!backup.appearance,
});

/** "3 creators · 12 calendar items · 1 saved template · your look" */
export function describeCounts(counts) {
  const n = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const parts = [n(counts.creators, 'creator'), n(counts.events, 'calendar item')];
  if (counts.templates) parts.push(n(counts.templates, 'saved template'));
  if (counts.look) parts.push('your look');
  return parts.join(' · ');
}

const NOT_A_BACKUP = 'This file isn’t a Stride workspace backup. Choose a file named like “stride-workspace-backup-….json”.';

/** Reads a backup file's text and checks it. Returns { backup } or { error }. */
export function parseBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: NOT_A_BACKUP };
  }
  if (!raw || raw.app !== BACKUP_APP || !raw.workspace || typeof raw.workspace !== 'object') return { error: NOT_A_BACKUP };
  if (Number(raw.version) > BACKUP_VERSION) return { error: 'This backup was made by a newer version of the workspace. Update this copy first.' };

  const ws = raw.workspace;
  for (const key of ['creators', 'templates', 'events']) {
    if (ws[key] !== undefined && !Array.isArray(ws[key])) return { error: `The backup’s ${key} are damaged, so nothing was restored.` };
  }
  const creators = list(ws.creators);
  const templates = list(ws.templates);
  const events = list(ws.events);
  if (creators.some((c) => !c || typeof c.id !== 'string' || typeof c.firstName !== 'string'))
    return { error: 'Some creators in the backup are damaged, so nothing was restored.' };
  if (templates.some((t) => !t || typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.body !== 'string'))
    return { error: 'Some templates in the backup are damaged, so nothing was restored.' };
  if (events.some((e) => !e || typeof e.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(String(e.date))))
    return { error: 'Some calendar items in the backup are damaged, so nothing was restored.' };

  return {
    backup: {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      workspace: { creators, templates, events },
      appearance: objectOrNull(raw.appearance),
      calendarPrefs: objectOrNull(raw.calendarPrefs),
    },
  };
}

async function write(backup) {
  const put = (key, value) => (value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)));
  put(APPEARANCE_KEY, backup.appearance);
  put(CALENDAR_PREFS_KEY, backup.calendarPrefs);
  await writePrivate(WORKSPACE_KEY, backup.workspace); // encrypted when a password is set
}

/**
 * Replaces everything in this browser with the backup.
 * First keeps a safety copy of what's here now so the restore can be undone. If there's no
 * room for that copy, it stops with error code NO_SAFETY_COPY unless `requireSafetyCopy` is false.
 */
export async function restoreBackup(backup, { requireSafetyCopy = true, now = new Date() } = {}) {
  const current = collectBackup(now);
  try {
    await writePrivate(SAFETY_COPY_KEY, current);
  } catch {
    if (requireSafetyCopy) {
      const err = new Error('There isn’t room in this browser to keep a safety copy of your current data.');
      err.code = 'NO_SAFETY_COPY';
      throw err;
    }
  }
  try {
    await write(backup);
  } catch {
    try {
      await write(current); // put things back the way they were
    } catch {
      /* nothing more we can do */
    }
    throw new Error('There isn’t enough room in this browser to restore this backup. Nothing was changed.');
  }
}

/** When the safety copy from the last restore was taken, or null if there isn't one. */
export function safetyCopyTakenAt() {
  return readPrivate(SAFETY_COPY_KEY)?.exportedAt || null;
}

/** Puts back the data from before the last restore. */
export async function undoRestore() {
  const copy = readPrivate(SAFETY_COPY_KEY);
  if (!copy?.workspace) return false;
  await write(copy);
  await writePrivate(SAFETY_COPY_KEY, null);
  return true;
}

export const lastBackupAt = () => {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
};
export const markBackedUp = (now = new Date()) => {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, now.toISOString());
  } catch {
    /* not critical */
  }
};

/** True when there's something worth saving and no backup in the last week. */
export function needsBackup({ hasData, lastBackup, now = new Date() }) {
  if (!hasData) return false;
  if (!lastBackup) return true;
  return now.getTime() - new Date(lastBackup).getTime() > BACKUP_EVERY_DAYS * 86_400_000;
}

/** "Never", "Today at 3:52 PM", "Yesterday" or "Nov 2 (9 days ago)" */
export function describeWhen(iso, now = new Date()) {
  if (!iso) return 'Never';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'Never';
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayStart(now) - dayStart(at)) / 86_400_000);
  if (days <= 0) return `Today at ${at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  if (days === 1) return 'Yesterday';
  return `${at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${days} days ago)`;
}
