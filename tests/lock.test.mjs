import { fileURLToPath as __toPath } from 'node:url';
const ROOT = process.argv[2] || __toPath(new URL('..', import.meta.url));
import { pathToFileURL } from 'node:url';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const root = ROOT;
const s = await import(pathToFileURL(`${root}/src/storage.js`));
const lock = await import(pathToFileURL(`${root}/src/lock.js`));
const backup = await import(pathToFileURL(`${root}/src/backup.js`));

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n   got ${JSON.stringify(actual)}\n   want ${JSON.stringify(expected)}`}`);
};
const rawEverything = () => [...store.values()].join('\n');

// Some data saved without a password
await s.saveRecord('creator', { id: 'c1', firstName: 'Amelia', lastName: 'Secretname', email: 'amelia@private.example' });
await s.saveRecord('event', { id: 'e1', type: 'brand-outreach', date: '2026-11-13', brand: 'Lego', creatorName: 'Amelia Secretname', notes: 'confidential rate 5000' });
check('before: readable in storage', rawEverything().includes('Secretname'), true);

// Password rules
check('too short', lock.checkNewPassword('short', 'short'), 'Use at least 8 characters.');
check('mismatch', lock.checkNewPassword('longenough1', 'longenough2'), 'The two passwords don’t match.');
check('ok', lock.checkNewPassword('longenough1', 'longenough1'), null);

// Turn on the password
await s.enablePassword('correct horse', { hint: 'the stable', autoLockMinutes: 15 });
check('lock is on', !!lock.lockConfig(), true);
check('names no longer readable in storage', /Secretname|private\.example|confidential|Lego/.test(rawEverything()), false);
check('password itself is not stored', rawEverything().includes('correct horse'), false);
check('hint and auto-lock saved', [lock.lockConfig().hint, lock.lockConfig().autoLockMinutes], ['the stable', 15]);
check('still usable while unlocked', (await s.loadWorkspace()).creators[0].lastName, 'Secretname');
await s.saveRecord('creator', { id: 'c2', firstName: 'Ben', lastName: 'Hidden' });
check('new saves are encrypted too', rawEverything().includes('Hidden'), false);

// Lock
s.forgetKey();
check('locked', s.isLocked(), true);
let lockedError = '';
try {
  await s.loadWorkspace();
} catch (e) {
  lockedError = e.message;
}
check('reading while locked is refused', lockedError, 'The workspace is locked.');

// Unlock
check('wrong password', await s.unlock('wrong horse'), false);
check('still locked after wrong password', s.isLocked(), true);
check('right password', await s.unlock('correct horse'), true);
check('data back after unlock', (await s.loadWorkspace()).creators.map((c) => c.firstName).sort(), ['Amelia', 'Ben']);

// Backups are readable (so they can rescue a forgotten password), restore stays encrypted
const file = JSON.stringify(backup.collectBackup());
check('backup file is readable', file.includes('Secretname'), true);
await backup.restoreBackup(backup.parseBackup(file).backup);
check('after restore: still encrypted at rest', /Secretname|Hidden/.test(rawEverything()), false);
check('safety copy encrypted at rest', !!backup.safetyCopyTakenAt() && !rawEverything().includes('Amelia'), true);
check('undo restore works while locked-mode', await backup.undoRestore(), true);

// Change password
check('change with wrong current password', await s.changePassword('nope', 'battery staple'), false);
check('change with right current password', await s.changePassword('correct horse', 'battery staple'), true);
s.forgetKey();
check('old password no longer works', await s.unlock('correct horse'), false);
check('new password works', await s.unlock('battery staple'), true);
check('data intact after change', (await s.loadWorkspace()).events[0].brand, 'Lego');

// Settings without the password
s.updateLockSettings({ autoLockMinutes: 5 });
check('auto-lock updated', lock.lockConfig().autoLockMinutes, 5);

// Turn off
check('turn off with wrong password', await s.disablePassword('nope'), false);
check('turn off with right password', await s.disablePassword('battery staple'), true);
check('lock is off', lock.lockConfig(), null);
check('data readable again', rawEverything().includes('Secretname'), true);
check('works without password', (await s.loadWorkspace()).creators.length, 2);

// Forgot password: erase
await s.enablePassword('another pass', {});
s.forgetKey();
s.eraseLockedWorkspace();
check('erase: no lock, no data', [lock.lockConfig(), (await s.loadWorkspace()).creators.length], [null, 0]);

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
