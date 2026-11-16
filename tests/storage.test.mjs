import { fileURLToPath as __toPath, pathToFileURL } from 'node:url';
const ROOT = process.argv[2] || __toPath(new URL('..', import.meta.url));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const s = await import(pathToFileURL(`${ROOT}/src/storage.js`));

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n   got ${JSON.stringify(actual)}\n   want ${JSON.stringify(expected)}`}`);
};

await s.saveRecord('creator', { id: 'a', firstName: 'Ana', engagementRate: '' });
await s.saveRecord('creator', { id: 'b', firstName: 'Ben', engagementRate: '' });
await s.saveRecord('event', { id: 'e1', date: '2026-11-13', title: 'Keep me' });
await s.saveImport([{ id: 'n', firstName: 'New' }], [{ id: 'b', firstName: 'Ben', engagementRate: '3.1' }]);
const data = await s.loadWorkspace();
check('import: new creator first, updated one replaced in place', data.creators.map((c) => `${c.id}:${c.engagementRate ?? ''}`), ['n:', 'b:3.1', 'a:']);
check('import: other data untouched', data.events.map((e) => e.title), ['Keep me']);
await s.saveImport([], []);
check('empty import changes nothing', (await s.loadWorkspace()).creators.length, 3);

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
