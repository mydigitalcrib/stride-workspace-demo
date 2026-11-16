import { fileURLToPath as __toPath } from 'node:url';
const ROOT = process.argv[2] || __toPath(new URL('..', import.meta.url));
import { pathToFileURL } from 'node:url';

// Minimal localStorage stand-in, with an optional size limit to simulate a full browser.
const store = new Map();
let limit = Infinity;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    const size = [...store.entries()].filter(([key]) => key !== k).reduce((n, [, val]) => n + val.length, 0) + String(v).length;
    if (size > limit) throw new Error('QuotaExceededError');
    store.set(k, String(v));
  },
  removeItem: (k) => store.delete(k),
};

const b = await import(pathToFileURL(`${ROOT}/src/backup.js`));
const WS = 'stride-talent-workspace:v1';
const LOOK = 'stride-talent-workspace:appearance:v1';
const PREFS = 'stride-talent-workspace:calendar-prefs:v1';

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n   got ${JSON.stringify(actual)}\n   want ${JSON.stringify(expected)}`}`);
};

// Data "in this browser"
const mine = {
  creators: [{ id: 'c1', firstName: 'Ana', lastName: 'Lopez', followUp: '2026-11-20' }, { id: 'c2', firstName: 'Ben' }],
  templates: [{ id: 'tpl-intro', title: 'Intro', body: 'Hi {{firstName}}' }],
  events: [{ id: 'e1', type: 'brand-outreach', date: '2026-11-13', brand: 'Lego', creatorName: 'Ana Lopez', status: 'Contacted' }],
};
store.set(WS, JSON.stringify(mine));
store.set(LOOK, JSON.stringify({ mode: 'dark', theme: 'rose' }));
store.set(PREFS, JSON.stringify({ weekend: true, creatorItems: true }));

const backup = b.collectBackup(new Date('2026-11-11T18:00:00Z'));
check('backup has everything', [backup.app, backup.version, backup.workspace.creators.length, backup.workspace.events.length, backup.appearance.theme, backup.calendarPrefs.weekend], ['stride-talent-workspace', 1, 2, 1, 'rose', true]);
check('describe counts', b.describeCounts(b.countsOf(backup)), '2 creators · 1 calendar item · 1 saved template · your look');
const text = JSON.stringify(backup, null, 2);

// Round trip into an empty browser
store.clear();
const parsed = b.parseBackup(text);
check('parse ok', !!parsed.backup && !parsed.error, true);
await b.restoreBackup(parsed.backup);
check('restored workspace', JSON.parse(store.get(WS)), mine);
check('restored look + prefs', [JSON.parse(store.get(LOOK)).theme, JSON.parse(store.get(PREFS)).weekend], ['rose', true]);
check('safety copy of the empty browser kept', b.safetyCopyTakenAt() !== null, true);

// Undo puts back what was there before (nothing)
check("undo works", await b.undoRestore(), true);
check('after undo: empty again', [b.collectBackup().workspace.creators.length, store.has(LOOK)], [0, false]);
check('safety copy gone after undo', b.safetyCopyTakenAt(), null);

// Bad files are rejected and nothing changes
store.set(WS, JSON.stringify(mine));
const before = store.get(WS);
const bad = [
  ['not JSON', 'hello'],
  ['other app', JSON.stringify({ app: 'something-else', workspace: {} })],
  ['newer version', JSON.stringify({ ...backup, version: 99 })],
  ['damaged creators', JSON.stringify({ ...backup, workspace: { ...backup.workspace, creators: [{ name: 'no id' }] } })],
  ['damaged events', JSON.stringify({ ...backup, workspace: { ...backup.workspace, events: [{ id: 'x', date: 'soon' }] } })],
  ['creators not a list', JSON.stringify({ ...backup, workspace: { creators: 'oops' } })],
];
for (const [name, file] of bad) check(`rejects ${name}`, typeof b.parseBackup(file).error, 'string');
check('rejected files change nothing', store.get(WS), before);

// A backup without look/prefs removes the old ones (it really is "everything from the backup")
await b.restoreBackup(b.parseBackup(JSON.stringify({ app: 'stride-talent-workspace', version: 1, workspace: { creators: [] } })).backup);
check('missing look in backup → default look', store.has(LOOK), false);
await b.undoRestore();

// Full browser: no room for a safety copy
store.clear();
store.set(WS, JSON.stringify(mine));
limit = store.get(WS).length + 50; // room for the data, not for a copy
let code = null;
try {
  await b.restoreBackup(parsed.backup);
} catch (e) {
  code = e.code;
}
check('no room for safety copy → asks first', code, 'NO_SAFETY_COPY');
check('…and nothing changed', store.get(WS), JSON.stringify(mine));

// Not enough room for the backup itself → rolled back
limit = 200;
let message = '';
try {
  await b.restoreBackup(parsed.backup, { requireSafetyCopy: false });
} catch (e) {
  message = e.message;
}
check('too big to restore → clear message', message.startsWith('There isn’t enough room'), true);
check('…and the old data is still there', JSON.parse(store.get(WS) || '{}').creators?.length, 2);
limit = Infinity;

// Reminders to back up
const now = new Date('2026-11-11T12:00:00Z');
check('no data → no nudge', b.needsBackup({ hasData: false, lastBackup: null, now }), false);
check('data, never backed up → nudge', b.needsBackup({ hasData: true, lastBackup: null, now }), true);
check('backed up 3 days ago → no nudge', b.needsBackup({ hasData: true, lastBackup: '2026-11-08T12:00:00Z', now }), false);
check('backed up 8 days ago → nudge', b.needsBackup({ hasData: true, lastBackup: '2026-11-03T12:00:00Z', now }), true);
check('describe never', b.describeWhen(null), 'Never');
check('describe yesterday', b.describeWhen('2026-11-10T15:00:00', new Date('2026-11-11T10:00:00')), 'Yesterday');
check('describe days ago', b.describeWhen('2026-11-02T15:00:00', new Date('2026-11-11T10:00:00')), 'Nov 2 (9 days ago)');

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
