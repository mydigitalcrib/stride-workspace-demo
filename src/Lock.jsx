import { createContext, useContext, useEffect, useState } from 'react';
import { KeyRound, Lock, LockOpen, ShieldCheck, X } from 'lucide-react';
import { applyAppearance, computeAppearance, loadAppearance, resolveMode } from './appearance.js';
import { AUTO_LOCK_OPTIONS, MIN_PASSWORD_LENGTH, checkNewPassword, lockConfig } from './lock.js';
import { changePassword, disablePassword, enablePassword, eraseLockedWorkspace, forgetKey, unlock, updateLockSettings } from './storage.js';

const LockContext = createContext({ enabled: false, lockNow: () => {}, refresh: () => {}, startup: null, clearStartup: () => {} });
/** { enabled, autoLockMinutes, lockNow(), refresh(), startup } for the rest of the app. */
export const useLock = () => useContext(LockContext);

const ACTIVITY = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];

/**
 * Wraps the app. With a password set, shows the lock screen until it's unlocked, and locks
 * again after the chosen time without activity. Locking removes the app (and its data) from memory.
 */
export function LockGate({ children }) {
  const [, setVersion] = useState(0);
  const [locked, setLocked] = useState(() => !!lockConfig());
  const [startup, setStartup] = useState(null);
  const config = lockConfig();
  const enabled = !!config;
  const minutes = config?.autoLockMinutes || 0;

  const lockNow = () => {
    forgetKey();
    setLocked(true);
  };
  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (locked || !enabled || !minutes) return undefined;
    const limit = minutes * 60_000;
    let last = Date.now();
    let timer;
    const reset = () => {
      last = Date.now();
      clearTimeout(timer);
      timer = setTimeout(lockNow, limit);
    };
    // Background tabs can delay timers, so also check when the page comes back into view.
    const onVisible = () => document.visibilityState === 'visible' && Date.now() - last >= limit && lockNow();
    ACTIVITY.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    reset();
    return () => {
      clearTimeout(timer);
      ACTIVITY.forEach((name) => window.removeEventListener(name, reset));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [locked, enabled, minutes]);

  if (locked) {
    return (
      <LockScreen
        onUnlocked={() => setLocked(false)}
        onErased={() => {
          setStartup('erased');
          setLocked(false);
        }}
      />
    );
  }
  return (
    <LockContext.Provider value={{ enabled, autoLockMinutes: minutes, lockNow, refresh, startup, clearStartup: () => setStartup(null) }}>
      {children}
    </LockContext.Provider>
  );
}

function LockScreen({ onUnlocked, onErased }) {
  const config = lockConfig();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);

  // Show the lock screen in the chosen colours and mode.
  useEffect(() => {
    const saved = loadAppearance();
    const deviceDark = !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    applyAppearance(computeAppearance(saved, resolveMode(saved.mode, deviceDark)));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      if (await unlock(password)) {
        onUnlocked();
        return;
      }
      setError('That password isn’t right. Try again.');
      setPassword('');
    } catch {
      setError('The workspace couldn’t be opened. If this keeps happening, use “Forgot your password?” below and restore a backup.');
    }
    setBusy(false);
  }

  return (
    <div className="lockScreen">
      <section className="lockCard" aria-labelledby="lock-title">
        <div className="brand">
          stride<span>talent</span>
          <i>↗</i>
        </div>
        <span className="lockBadge">
          <Lock size={18} />
        </span>
        <h1 id="lock-title">Welcome back, Michelle.</h1>
        <p>Your workspace is locked. Enter your password to open it.</p>
        <form onSubmit={submit}>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy || !password}>
            {busy ? 'Unlocking…' : 'Unlock'}
            <LockOpen size={16} />
          </button>
        </form>

        {config?.hint && (
          <details className="lockMore">
            <summary>Show my password hint</summary>
            <p>{config.hint}</p>
          </details>
        )}
        <details className="lockMore">
          <summary>Forgot your password?</summary>
          <p>
            Your data is scrambled with your password, so nobody can open it without it, not even with this computer. If you have a backup
            file, you can erase this workspace, then restore the backup from the Backup button.
          </p>
          {!confirmErase ? (
            <button type="button" onClick={() => setConfirmErase(true)}>
              Erase this workspace and start over
            </button>
          ) : (
            <div className="eraseConfirm">
              <p>
                This deletes all creators, calendar items and saved templates in this browser, and removes the password. Your look stays.
                It can’t be undone without a backup file.
              </p>
              <div>
                <button type="button" onClick={() => setConfirmErase(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    eraseLockedWorkspace();
                    onErased();
                  }}
                >
                  Yes, erase everything
                </button>
              </div>
            </div>
          )}
        </details>
        <p className="lockFoot">Stays on this computer. Nothing is sent online.</p>
      </section>
    </div>
  );
}

/** "Password & lock" settings: set a password, or manage the one you have. */
export default function SecurityPanel({ onClose, notify, onOpenBackup }) {
  const lock = useLock();
  const config = lockConfig();
  const [form, setForm] = useState({ password: '', confirm: '', current: '', hint: config?.hint || '', autoLock: config?.autoLockMinutes ?? 15, agree: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const hintProblem = (hint, password) =>
    password && hint.toLowerCase().includes(password.toLowerCase()) ? 'Don’t put the password itself in the hint.' : null;

  async function turnOn(e) {
    e.preventDefault();
    const problem = checkNewPassword(form.password, form.confirm) || hintProblem(form.hint, form.password);
    if (problem) return setError(problem);
    if (!form.agree) return setError('Tick the box to confirm you’ve read how a forgotten password works.');
    setBusy('on');
    setError('');
    try {
      await enablePassword(form.password, { hint: form.hint, autoLockMinutes: Number(form.autoLock) });
      lock.refresh();
      notify('Password set. You’ll be asked for it when you open the workspace.', 6000);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
    return undefined;
  }

  async function change(e) {
    e.preventDefault();
    const problem = checkNewPassword(form.password, form.confirm) || hintProblem(form.hint, form.password);
    if (problem) return setError(problem);
    setBusy('change');
    setError('');
    try {
      if (!(await changePassword(form.current, form.password, { hint: form.hint }))) {
        setError('Your current password isn’t right.');
      } else {
        lock.refresh();
        notify('Password changed.');
        onClose();
        return undefined;
      }
    } catch (err) {
      setError(err.message);
    }
    setBusy('');
    return undefined;
  }

  async function turnOff(e) {
    e.preventDefault();
    setBusy('off');
    setError('');
    try {
      if (!(await disablePassword(form.current))) {
        setError('Your current password isn’t right.');
      } else {
        lock.refresh();
        notify('Password turned off. Your data is saved without a password again.', 6000);
        onClose();
        return undefined;
      }
    } catch (err) {
      setError(err.message);
    }
    setBusy('');
    return undefined;
  }

  function saveSettings(changes, message) {
    updateLockSettings(changes);
    lock.refresh();
    notify(message);
  }

  const passwordFields = (newLabel) => (
    <>
      <label>
        {newLabel}
        <input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} />
      </label>
      <label>
        Type it again
        <input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => set({ confirm: e.target.value })} />
      </label>
    </>
  );

  return (
    <div className="overlay" onClick={() => !busy && onClose()}>
      <section className="templateModal securityModal" role="dialog" aria-modal="true" aria-label="Password and lock" onClick={(e) => e.stopPropagation()}>
        <div className="drawerHead">
          <div>
            <span className="eyebrow">PASSWORD &amp; LOCK</span>
            <h2>{config ? 'Your workspace is protected' : 'Protect your workspace'}</h2>
          </div>
          <button className="icon" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="securityBody">
          {!config ? (
            <form onSubmit={turnOn}>
              <ul className="securityPoints">
                <li>
                  <Lock size={14} /> The workspace asks for your password every time you open it.
                </li>
                <li>
                  <KeyRound size={14} /> Your creators, calendar and notes are scrambled in this browser, so they can’t be read without it.
                </li>
                <li>
                  <ShieldCheck size={14} /> Everything stays on this computer. Nothing is sent online.
                </li>
              </ul>
              <div className="formgrid">
                {passwordFields(`New password (at least ${MIN_PASSWORD_LENGTH} characters)`)}
                <label className="full">
                  Hint (optional, shown on the lock screen)
                  <input value={form.hint} placeholder="Something only you would understand" onChange={(e) => set({ hint: e.target.value })} />
                </label>
                <label className="full">
                  Lock automatically
                  <select value={form.autoLock} onChange={(e) => set({ autoLock: Number(e.target.value) })}>
                    {AUTO_LOCK_OPTIONS.map(([minutes, label]) => (
                      <option key={minutes} value={minutes}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="forgotWarning">
                <b>If you forget the password, your data can’t be unlocked.</b> The only way back is a backup file.{' '}
                <button type="button" onClick={onOpenBackup}>
                  Download a backup first
                </button>
              </div>
              <label className="checkRow">
                <input type="checkbox" checked={form.agree} onChange={(e) => set({ agree: e.target.checked })} />
                I understand a forgotten password can only be recovered from a backup file.
              </label>
              {error && <p className="error">{error}</p>}
              <button className="primary" disabled={!!busy}>
                {busy ? 'Setting your password…' : 'Turn on password'}
                <Lock size={15} />
              </button>
            </form>
          ) : (
            <>
              <div className="securityStatus">
                <span className="backupIcon">
                  <ShieldCheck size={18} />
                </span>
                <p>Data saved in this browser is scrambled with your password. Backup files aren’t, so keep them somewhere private.</p>
                <button className="primary" onClick={lock.lockNow}>
                  <Lock size={15} />
                  Lock now
                </button>
              </div>

              <label>
                Lock automatically
                <select
                  value={config.autoLockMinutes ?? 0}
                  onChange={(e) => {
                    const minutes = Number(e.target.value);
                    saveSettings({ autoLockMinutes: minutes }, minutes ? `Locks after ${minutes} minutes away.` : 'Only locks when you click Lock.');
                  }}
                >
                  {AUTO_LOCK_OPTIONS.map(([minutes, label]) => (
                    <option key={minutes} value={minutes}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <details className="securitySection" onToggle={() => setError('')}>
                <summary>Change password</summary>
                <form onSubmit={change}>
                  <label>
                    Current password
                    <input type="password" autoComplete="current-password" value={form.current} onChange={(e) => set({ current: e.target.value })} />
                  </label>
                  <div className="formgrid">{passwordFields('New password')}</div>
                  <label>
                    Hint (optional)
                    <input value={form.hint} onChange={(e) => set({ hint: e.target.value })} />
                  </label>
                  <button className="primary" disabled={!!busy}>
                    {busy === 'change' ? 'Changing…' : 'Change password'}
                  </button>
                </form>
              </details>

              <details className="securitySection" onToggle={() => setError('')}>
                <summary>Turn off password</summary>
                <form onSubmit={turnOff}>
                  <p className="help">Your data will be saved without a password again, and the workspace won’t lock.</p>
                  <label>
                    Current password
                    <input type="password" autoComplete="current-password" value={form.current} onChange={(e) => set({ current: e.target.value })} />
                  </label>
                  <button disabled={!!busy}>{busy === 'off' ? 'Turning off…' : 'Turn off password'}</button>
                </form>
              </details>

              {error && <p className="error">{error}</p>}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
