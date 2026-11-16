import { useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { DEFAULT_UPDATE_FIELDS } from './csv.js';
import { plural } from './data.js';

const LABELS = {
  engagementRate: 'Engagement rate',
  engagementSource: 'ER source',
  engagementDate: 'ER checked on',
  followers: 'Followers',
  viewsInstagram: 'Instagram views',
  viewsTiktok: 'TikTok views',
  viewsYoutube: 'YouTube views',
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  instagram: 'Instagram link',
  tiktok: 'TikTok link',
  niche: 'Niche',
  brand: 'Brand',
  collabDate: 'Collaboration date',
  approval: 'Approval',
  reason: 'Decision reason',
  outreach: 'Pipeline stage',
  owner: 'Owner',
  followUp: 'Follow-up date',
  fit: 'Creator fit',
  bookingStatus: 'Booking status',
  handoffStatus: 'Stride OS handoff',
  partnerStatus: 'Stride Partner referral',
  deckLanguage: 'Deck language',
  deckOverride: 'Signing deck',
};
const label = (key) => LABELS[key] || key;
const show = (key, value) => (value === '' || value == null ? '—' : key === 'engagementRate' ? `${value}%` : value);

/** Shows what a CSV import will do and lets you choose before anything is saved. */
export default function ImportDialog({ plan, fileName, busy, onConfirm, onClose }) {
  const changedFields = Object.keys(plan.fieldCounts);
  const [addNew, setAddNew] = useState(true);
  const [update, setUpdate] = useState(plan.updates.length > 0);
  const [fields, setFields] = useState(() => changedFields.filter((key) => DEFAULT_UPDATE_FIELDS.includes(key)));
  const toggle = (key) => setFields((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));

  const updatesChosen = update ? plan.updates.filter((u) => Object.keys(u.values).some((key) => fields.includes(key))) : [];
  const willAdd = addNew ? plan.newRecords.length : 0;
  const nothing = !willAdd && !updatesChosen.length;

  return (
    <div className="overlay" onClick={() => !busy && onClose()}>
      <section className="templateModal importModal" role="dialog" aria-modal="true" aria-label="Import CSV" onClick={(e) => e.stopPropagation()}>
        <div className="drawerHead">
          <div>
            <span className="eyebrow">IMPORT CSV</span>
            <h2>{fileName}</h2>
          </div>
          <button className="icon" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="importBody">
          <p className="help">Nothing is saved until you click Import.</p>

          {plan.newRecords.length > 0 && (
            <label className="checkRow importChoice">
              <input type="checkbox" checked={addNew} onChange={(e) => setAddNew(e.target.checked)} />
              <span>
                <b>Add {plural(plan.newRecords.length, 'new creator')}</b>
                <small>
                  {plan.newRecords
                    .slice(0, 4)
                    .map((c) => `${c.firstName} ${c.lastName}`.trim())
                    .join(', ')}
                  {plan.newRecords.length > 4 ? ` and ${plan.newRecords.length - 4} more` : ''}
                </small>
              </span>
            </label>
          )}

          {plan.updates.length > 0 && (
            <>
              <label className="checkRow importChoice">
                <input type="checkbox" checked={update} onChange={(e) => setUpdate(e.target.checked)} />
                <span>
                  <b>Update {plural(plan.updates.length, 'creator')} already in your workspace</b>
                  <small>Only the details you tick below change. Blank cells never erase anything, and notes are never changed.</small>
                </span>
              </label>
              {update && (
                <div className="fieldPicker">
                  {changedFields.map((key) => (
                    <label key={key} className="checkRow">
                      <input type="checkbox" checked={fields.includes(key)} onChange={() => toggle(key)} />
                      {label(key)} <span className="muted">({plan.fieldCounts[key]})</span>
                    </label>
                  ))}
                </div>
              )}
              {update && updatesChosen.length > 0 && (
                <ul className="importPreview">
                  {updatesChosen.slice(0, 6).map(({ existing, values }) => (
                    <li key={existing.id}>
                      <b>{`${existing.firstName} ${existing.lastName || ''}`.trim()}:</b>{' '}
                      {Object.entries(values)
                        .filter(([key]) => fields.includes(key))
                        .map(([key, value]) => `${label(key)} ${show(key, existing[key])} → ${show(key, value)}`)
                        .join(' · ')}
                    </li>
                  ))}
                  {updatesChosen.length > 6 && <li className="muted">…and {updatesChosen.length - 6} more</li>}
                </ul>
              )}
            </>
          )}

          <ul className="importNotes">
            {plan.unchanged > 0 && <li>{plural(plan.unchanged, 'creator')} already up to date</li>}
            {plan.duplicatesInFile > 0 && <li>{plural(plan.duplicatesInFile, 'repeated row')} in the file skipped</li>}
            {plan.skippedNoName.length > 0 && (
              <li>
                {plural(plan.skippedNoName.length, 'row')} skipped: not in your workspace and no first name (row
                {plan.skippedNoName.length > 1 ? 's' : ''} {plan.skippedNoName.slice(0, 8).join(', ')}
                {plan.skippedNoName.length > 8 ? '…' : ''})
              </li>
            )}
          </ul>
        </div>

        <div className="drawerFoot">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary" disabled={busy || nothing} onClick={() => onConfirm({ addNew, fields: update ? fields : [] })}>
            <FileUp size={15} />
            {busy
              ? 'Importing…'
              : nothing
                ? 'Nothing to import'
                : `Import${willAdd ? ` · add ${willAdd}` : ''}${updatesChosen.length ? ` · update ${updatesChosen.length}` : ''}`}
          </button>
        </div>
      </section>
    </div>
  );
}
