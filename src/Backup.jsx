import { useEffect, useRef, useState } from 'react';
import { ArchiveRestore, FileUp, HardDrive, HardDriveDownload, ShieldCheck, TriangleAlert, Undo2, X } from 'lucide-react';
import { getFileStatus, onFileStatus } from './fileSync.js';
import {
  collectBackup,
  countsOf,
  describeCounts,
  describeWhen,
  markBackedUp,
  parseBackup,
  restoreBackup,
  safetyCopyTakenAt,
  undoRestore,
} from './backup.js';
import { downloadCsv } from './csv.js';
import { today } from './data.js';

/** The "Back up & restore" window. `onRestored(message)` refreshes the app after a restore or undo. */
export default function BackupPanel({ lastBackup, onBackedUp, onRestored, onClose, notify }) {
  const [current] = useState(() => countsOf(collectBackup()));
  const [picked, setPicked] = useState(null); // { backup, counts, name }
  const [error, setError] = useState('');
  const [safetyAt] = useState(safetyCopyTakenAt);
  const [fileStatus, setFileStatus] = useState(getFileStatus);
  const fileInput = useRef(null);
  useEffect(() => onFileStatus(setFileStatus), []);
  const savedTime = fileStatus.lastSavedAt
    ? new Date(fileStatus.lastSavedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'not yet';

  function download() {
    const now = new Date();
    downloadCsv(JSON.stringify(collectBackup(now), null, 2), `stride-workspace-backup-${today()}.json`, 'application/json');
    markBackedUp(now);
    onBackedUp(now.toISOString());
    notify('Backup downloaded. Keep it somewhere safe, like OneDrive or Google Drive.');
  }

  async function choose(file) {
    setError('');
    setPicked(null);
    if (file.size > 25 * 1024 * 1024) {
      setError('That file is too big to be a workspace backup.');
      return;
    }
    const result = parseBackup(await file.text());
    if (result.error) setError(result.error);
    else setPicked({ backup: result.backup, counts: countsOf(result.backup), name: file.name });
  }

  async function restore() {
    try {
      await restoreBackup(picked.backup);
    } catch (err) {
      if (err.code !== 'NO_SAFETY_COPY') {
        setError(err.message);
        return;
      }
      if (!window.confirm(`${err.message} If you continue, you won’t be able to undo this restore. Replace everything anyway?`)) return;
      try {
        await restoreBackup(picked.backup, { requireSafetyCopy: false });
      } catch (again) {
        setError(again.message);
        return;
      }
    }
    onRestored(`Backup restored: ${describeCounts(picked.counts)}`);
  }

  async function undo() {
    if (!window.confirm('Go back to the data you had before the last restore? What’s here now will be replaced.')) return;
    if (await undoRestore()) onRestored('Restore undone. Your previous data is back.');
    else setError('The safety copy couldn’t be read, so nothing was changed.');
  }

  const backupDate = picked?.backup.exportedAt ? new Date(picked.backup.exportedAt) : null;

  return (
    <div className="overlay" onClick={onClose}>
      <section className="templateModal backupModal" role="dialog" aria-modal="true" aria-label="Back up and restore" onClick={(e) => e.stopPropagation()}>
        <div className="drawerHead">
          <div>
            <span className="eyebrow">YOUR DATA</span>
            <h2>Back up &amp; restore</h2>
          </div>
          <button className="icon" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="backupBody">
          {fileStatus.mode === 'file' ? (
            <div className={`backupCard autoSave ${fileStatus.error ? 'failing' : ''}`}>
              <span className="backupIcon">{fileStatus.error ? <TriangleAlert size={18} /> : <HardDrive size={18} />}</span>
              <div>
                <b>{fileStatus.error ? 'Saving to the file is having trouble' : 'Saved automatically on this computer'}</b>
                <p>{fileStatus.error || 'Every change is saved to this file, with a dated copy kept each day for 30 days:'}</p>
                <code className="filePath">{fileStatus.path}</code>
                <small>Last saved: {savedTime}</small>
              </div>
            </div>
          ) : (
            <div className="backupCard autoSave failing">
              <span className="backupIcon">
                <TriangleAlert size={18} />
              </span>
              <div>
                <b>Only saved in this browser right now</b>
                <p>
                  Open the workspace with “Start Stride Workspace”, or ask Claude to open it, so your data is also saved to a file on
                  this computer.
                </p>
              </div>
            </div>
          )}

          <p className="help">
            A backup file is an extra copy you can keep anywhere, or use to move your workspace to another computer. Backup files
            aren’t password-protected, so keep them somewhere private.
          </p>

          <div className="backupCard">
            <span className="backupIcon">
              <ShieldCheck size={18} />
            </span>
            <div>
              <b>Back up everything</b>
              <p>{describeCounts(current)}</p>
              <small>Last backup: {describeWhen(lastBackup)}</small>
            </div>
            <button className="primary" onClick={download}>
              <HardDriveDownload size={15} />
              Download backup
            </button>
          </div>

          <div className="backupCard">
            <span className="backupIcon">
              <ArchiveRestore size={18} />
            </span>
            <div>
              <b>Restore from a backup</b>
              <p>Replaces everything in this browser with a backup file. A safety copy of what’s here now is kept, so you can undo.</p>
            </div>
            <button onClick={() => fileInput.current?.click()}>
              <FileUp size={15} />
              Choose file
            </button>
          </div>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              if (e.target.files?.[0]) choose(e.target.files[0]);
              e.target.value = '';
            }}
          />

          {picked && (
            <div className="restorePreview" role="alert">
              <b>{picked.name}</b>
              <p>
                {backupDate && !Number.isNaN(backupDate.getTime())
                  ? `Backed up ${backupDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}. `
                  : ''}
                Contains {describeCounts(picked.counts)}.
              </p>
              <p className="replaceWarning">This replaces what’s in this browser now: {describeCounts(current)}.</p>
              <div className="restoreActions">
                <button type="button" onClick={() => setPicked(null)}>
                  Cancel
                </button>
                <button type="button" className="primary" onClick={restore}>
                  Replace with this backup
                </button>
              </div>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          {safetyAt && (
            <div className="undoRow">
              <Undo2 size={15} />
              <span>
                Restored the wrong file? You can bring back what you had before the last restore. Safety copy: {describeWhen(safetyAt)}.
              </span>
              <button type="button" onClick={undo}>
                Undo restore
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
