import { useEffect, useState } from 'react';
import {
  Bell,
  BellRing,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheckBig,
  Download,
  Link2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { downloadCsv } from './csv.js';
import { today } from './data.js';
import {
  BRAND_OUTREACH_DAY,
  CALENDAR_PREFS_KEY as PREFS_KEY,
  EMPTY_EVENT,
  EVENT_TYPES,
  OUTREACH_STATUSES,
  REMINDERS,
  STATUS_TONES,
  addDays,
  creatorItems,
  eventLabel,
  formatDate,
  formatTime,
  googleCalendarUrl,
  nextFriday,
  sortEvents,
  startOfWeek,
  toIcs,
  typeOf,
  validateEvent,
  weekLabel,
  weekday,
} from './calendar.js';

const loadPrefs = () => {
  try {
    return { weekend: false, creatorItems: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { weekend: false, creatorItems: true };
  }
};

const fullName = (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim();
const dayName = (date) => {
  const t = today();
  if (date === t) return 'Today';
  if (date === addDays(t, 1)) return 'Tomorrow';
  return formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' });
};

/** A new calendar item for a day. Brand outreach defaults to that week's Friday. */
export function newEvent(date = today(), type = 'task') {
  return {
    ...EMPTY_EVENT,
    id: crypto.randomUUID(),
    type,
    date: type === 'brand-outreach' && weekday(date) !== BRAND_OUTREACH_DAY ? nextFriday(date) : date,
  };
}

function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_TONES[status] || 'gray'}`}>
      <i />
      {status}
    </span>
  );
}

/**
 * The "My calendar" page: week planner, brand outreach tracker and what's coming up.
 * `events` are saved calendar items; creator follow-ups and booked calls are added automatically.
 */
export default function CalendarPage({ events, creators, readOnly, onSave, onMoveFollowUp, onOpenCreator, onEdit, notify }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today()));
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [permission, setPermission] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* preferences are optional */
    }
  }, [prefs]);

  const t = today();
  const days = Array.from({ length: prefs.weekend ? 7 : 5 }, (_, i) => addDays(weekStart, i));
  const synced = prefs.creatorItems ? creatorItems(creators) : [];
  const everything = [...events, ...synced];
  const itemsOn = (date) => sortEvents(everything.filter((e) => e.date === date));

  // progress for the week on screen (your own items)
  const weekItems = events.filter((e) => e.date >= days[0] && e.date <= days.at(-1));
  const weekDone = weekItems.filter((e) => e.done).length;
  const weekPercent = weekItems.length ? Math.round((weekDone / weekItems.length) * 100) : 0;

  const outreach = events.filter((e) => e.type === 'brand-outreach');
  const outreachShown = sortEvents(outreach.filter((e) => !statusFilter || e.status === statusFilter)).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const comingUp = sortEvents(everything.filter((e) => e.date >= t && !e.done))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7);

  const blocked = () => notify('Sample preview is read-only. Switch to My workspace to plan your own week.');

  function move(id, date) {
    if (readOnly) return blocked();
    if (id.startsWith('call:')) return notify('Booked calls follow their Google Calendar event. Change the time in the creator’s profile.');
    if (id.startsWith('followup:')) return onMoveFollowUp(id.slice('followup:'.length), date);
    const item = events.find((e) => e.id === id);
    if (!item || item.date === date) return undefined;
    onSave({ ...item, date });
    const when = formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' });
    notify(
      item.type === 'brand-outreach' && weekday(date) !== BRAND_OUTREACH_DAY
        ? `Moved to ${when}. Brand outreach usually lives on Fridays.`
        : `Moved to ${when}`,
    );
    return undefined;
  }

  function toggleDone(item) {
    if (readOnly) return blocked();
    onSave({ ...item, done: !item.done });
    return undefined;
  }

  function open(item) {
    if (item.source) {
      const creator = creators.find((c) => c.id === item.creatorId);
      if (creator) onOpenCreator(creator);
      return;
    }
    onEdit({ ...item });
  }

  function exportIcs() {
    const upcoming = everything.filter((e) => e.date >= days[0]);
    if (!upcoming.length) return notify('Nothing to export yet. Add something to your calendar first.');
    downloadCsv(toIcs(sortEvents(upcoming).sort((a, b) => a.date.localeCompare(b.date))), `stride-calendar-${days[0]}.ics`, 'text/calendar');
    notify(`Exported ${upcoming.length} item${upcoming.length === 1 ? '' : 's'}. Open the file to add them to your calendar.`);
    return undefined;
  }

  async function enableReminders() {
    if (typeof Notification === 'undefined') return;
    setPermission(await Notification.requestPermission());
  }

  const chip = (item) => {
    const type = typeOf(item.type);
    const canDrag = !readOnly && !item.locked;
    return (
      <div
        key={item.id}
        className={`chip ${item.done ? 'done' : ''} ${dragging === item.id ? 'dragging' : ''}`}
        style={{ '--type': type.color }}
        draggable={canDrag}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', item.id);
          e.dataTransfer.effectAllowed = 'move';
          setDragging(item.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setDragOver(null);
        }}
        onClick={() => open(item)}
        onKeyDown={(e) => e.key === 'Enter' && open(item)}
        role="button"
        tabIndex={0}
        title={canDrag ? 'Drag to another day, or click to open' : item.locked ? 'Booked call (set in the creator’s profile)' : undefined}
      >
        {!item.source && (
          <button
            type="button"
            className="check"
            aria-label={item.done ? `Mark “${eventLabel(item)}” not done` : `Mark “${eventLabel(item)}” done`}
            onClick={(e) => {
              e.stopPropagation();
              toggleDone(item);
            }}
          >
            {item.done ? <CircleCheckBig size={14} /> : <Circle size={14} />}
          </button>
        )}
        <div className="chipBody">
          {item.time && <small className="chipTime">{formatTime(item.time)}</small>}
          <b>{item.type === 'brand-outreach' ? item.brand || 'Brand' : eventLabel(item)}</b>
          {item.type === 'brand-outreach' && (
            <small>
              for {item.creatorName}
              {item.niche ? ` · ${item.niche}` : ''}
            </small>
          )}
          {item.type === 'brand-outreach' && <StatusBadge status={item.status} />}
          {item.source && (
            <small className="synced">
              <Link2 size={10} /> {item.source === 'call' ? 'Booked call' : 'From profile'}
            </small>
          )}
        </div>
        {item.reminder !== '' && item.reminder != null && !item.done && <Bell size={11} className="chipBell" aria-label="Reminder set" />}
      </div>
    );
  };

  return (
    <>
      <section className="panel planner">
        <div className="plannerHead">
          <div className="weekNav">
            <button className="icon" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft size={17} />
            </button>
            <button className="thisWeek" onClick={() => setWeekStart(startOfWeek(t))} disabled={weekStart === startOfWeek(t)}>
              This week
            </button>
            <button className="icon" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight size={17} />
            </button>
            <h2>{weekLabel(weekStart, days.length)}</h2>
          </div>
          <div className="weekProgress" title="Your own items this week">
            <span>
              <b>{weekDone}</b> of {weekItems.length} done
            </span>
            <div className="progress">
              <i style={{ width: `${weekPercent}%` }} />
            </div>
          </div>
        </div>

        <div className="plannerOptions">
          <label className="toggle">
            <input type="checkbox" checked={prefs.weekend} onChange={(e) => setPrefs({ ...prefs, weekend: e.target.checked })} />
            Show weekend
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={prefs.creatorItems}
              onChange={(e) => setPrefs({ ...prefs, creatorItems: e.target.checked })}
            />
            Show creator follow-ups &amp; calls
          </label>
          <span className="spacer" />
          {permission !== 'unsupported' && (
            <button
              onClick={enableReminders}
              disabled={permission !== 'default'}
              title={
                permission === 'denied'
                  ? 'This browser is blocking notifications for this site. Reminders still pop up inside the workspace; allow notifications in the browser’s site settings to get them on your desktop too.'
                  : 'Pop-up reminders on your desktop while this workspace is open'
              }
            >
              {permission === 'granted' ? <BellRing size={14} /> : <Bell size={14} />}
              {permission === 'granted' ? 'Desktop reminders on' : permission === 'denied' ? 'Desktop reminders blocked' : 'Turn on desktop reminders'}
            </button>
          )}
          <button onClick={exportIcs} title="Download a calendar file for Google Calendar, Outlook or Apple Calendar">
            <Download size={14} />
            Export to my calendar
          </button>
        </div>

        <div className="week" style={{ '--days': days.length }}>
          {days.map((date) => {
            const friday = weekday(date) === BRAND_OUTREACH_DAY;
            const items = itemsOn(date);
            return (
              <div
                key={date}
                className={`day ${date === t ? 'today' : ''} ${friday ? 'friday' : ''} ${dragOver === date ? 'dropping' : ''} ${date < t ? 'past' : ''}`}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOver !== date) setDragOver(date);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  setDragging(null);
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) move(id, date);
                }}
              >
                <div className="dayHead">
                  <small>{formatDate(date, { weekday: 'short' }).toUpperCase()}</small>
                  <b>{formatDate(date, { day: 'numeric' })}</b>
                  {friday && <span className="fridayTag">Brand outreach day</span>}
                </div>
                <div className="dayItems">
                  {items.map(chip)}
                  {!items.length && <p className="dayEmpty">{friday ? 'Plan the brands your creators asked for.' : 'Nothing planned'}</p>}
                </div>
                <button className="addInDay" onClick={() => (readOnly ? blocked() : onEdit(newEvent(date, friday ? 'brand-outreach' : 'task')))}>
                  <Plus size={13} />
                  {friday ? 'Brand outreach' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="legend">
          {EVENT_TYPES.map((type) => (
            <span key={type.id}>
              <i style={{ background: type.color }} />
              {type.name}
            </span>
          ))}
          <span className="legendHint">Drag items between days to reschedule.</span>
        </div>
      </section>

      <div className="calendarLower">
        <section className="panel outreachTracker">
          <div className="panelHead">
            <h2>
              Brand outreach tracker <span>FRIDAYS</span>
            </h2>
            <button onClick={() => (readOnly ? blocked() : onEdit(newEvent(t, 'brand-outreach')))}>
              <Plus size={14} />
              Brand request
            </button>
          </div>
          <div className="pipeline">
            {OUTREACH_STATUSES.map((status) => (
              <button
                key={status}
                className={statusFilter === status ? 'chosen' : ''}
                onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
                aria-pressed={statusFilter === status}
              >
                <b>{outreach.filter((e) => e.status === status).length}</b>
                <span>{status}</span>
              </button>
            ))}
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>CREATOR · NICHE</th>
                  <th>REQUESTED BRAND</th>
                  <th>OUTREACH DATE</th>
                  <th>STATUS</th>
                  <th>NOTES</th>
                </tr>
              </thead>
              <tbody>
                {outreachShown.map((e) => (
                  <tr key={e.id} tabIndex={0} onClick={() => open(e)} onKeyDown={(k) => k.key === 'Enter' && open(e)}>
                    <td>
                      <strong>{e.creatorName}</strong>
                      <small>{e.niche || 'Niche not added'}</small>
                    </td>
                    <td>
                      <strong>{e.brand}</strong>
                    </td>
                    <td className={e.date < t && !['Deal agreed', 'Declined'].includes(e.status) ? 'due' : ''}>
                      {formatDate(e.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    <td onClick={(k) => k.stopPropagation()}>
                      <select
                        className={`statusSelect ${STATUS_TONES[e.status]}`}
                        aria-label={`Status for ${e.brand}`}
                        value={e.status}
                        onChange={(k) => (readOnly ? blocked() : onSave({ ...e, status: k.target.value }))}
                      >
                        {OUTREACH_STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="notesCell">{e.notes || <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!outreachShown.length && (
              <div className="empty small">
                <h3>{outreach.length ? 'Nothing with this status' : 'No brand requests yet'}</h3>
                <p>
                  {outreach.length
                    ? 'Pick another status above, or clear the filter.'
                    : 'When a creator asks you to approach a brand, add it here. It goes on the coming Friday.'}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="panel comingUp">
          <div className="panelHead">
            <h2>Coming up</h2>
            <Bell size={16} />
          </div>
          {comingUp.map((item) => (
            <button key={item.id} className="upNext" onClick={() => open(item)}>
              <i style={{ background: typeOf(item.type).color }} />
              <span>
                <b>{item.type === 'brand-outreach' ? `${item.brand} for ${item.creatorName}` : eventLabel(item)}</b>
                <small>
                  {dayName(item.date)}
                  {item.time ? ` · ${formatTime(item.time)}` : ''}
                  {item.reminder !== '' && item.reminder != null ? ' · reminder set' : ''}
                </small>
              </span>
            </button>
          ))}
          {!comingUp.length && <p className="help comingEmpty">Nothing coming up. Enjoy the quiet, or plan something.</p>}
          <p className="help syncNote">
            Creator follow-up dates and booked calls appear here automatically. Reminders pop up while this workspace is open. To
            have them in Google Calendar, Outlook or Apple Calendar too, use “Export to my calendar”.
          </p>
        </section>
      </div>
    </>
  );
}

/** Add or edit one calendar item. */
export function EventEditor({ value, creators, isNew, readOnly, error, busy, onChange, onSave, onDelete, onClose }) {
  const brand = value.type === 'brand-outreach';
  const set = (patch) => onChange({ ...value, ...patch });

  function setCreatorName(name) {
    const match = creators.find((c) => fullName(c).toLowerCase() === name.trim().toLowerCase());
    set({ creatorName: name, creatorId: match?.id || '', ...(match ? { niche: match.niche || value.niche } : {}) });
  }

  function submit(e) {
    e.preventDefault();
    onSave(value);
  }

  return (
    <div className="overlay" onClick={() => !busy && onClose()}>
      <section className="templateModal eventModal" role="dialog" aria-modal="true" aria-label="Calendar item" onClick={(e) => e.stopPropagation()}>
        <div className="drawerHead">
          <div>
            <span className="eyebrow">MY CALENDAR</span>
            <h2>{isNew ? 'Add to calendar' : eventLabel(value)}</h2>
          </div>
          <button className="icon" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          {readOnly && <div className="notice">Sample item · read-only preview</div>}
          <div className="typePicker" role="group" aria-label="Type">
            {EVENT_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                aria-pressed={value.type === type.id}
                style={{ '--type': type.color }}
                onClick={() => set({ type: type.id })}
              >
                <i />
                {type.name}
              </button>
            ))}
          </div>

          {brand ? (
            <>
              {weekday(value.date) !== BRAND_OUTREACH_DAY && (
                <p className="fridayHint">
                  Fridays are your Brand Outreach day.{' '}
                  <button type="button" onClick={() => set({ date: nextFriday(value.date) })}>
                    Move to {formatDate(nextFriday(value.date), { weekday: 'short', month: 'short', day: 'numeric' })}
                  </button>
                </p>
              )}
              <div className="formgrid">
                <label>
                  Creator
                  <input
                    list="calendar-creators"
                    required
                    value={value.creatorName}
                    placeholder="Who asked for this brand?"
                    onChange={(e) => setCreatorName(e.target.value)}
                  />
                </label>
                <label>
                  Niche
                  <input value={value.niche} placeholder="Fills in from the creator" onChange={(e) => set({ niche: e.target.value })} />
                </label>
                <label>
                  Requested brand
                  <input required value={value.brand} placeholder="e.g. Lego" onChange={(e) => set({ brand: e.target.value })} />
                </label>
                <label>
                  Status
                  <select value={value.status} onChange={(e) => set({ status: e.target.value })}>
                    {OUTREACH_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          ) : (
            <div className="formgrid">
              <label className="full">
                Title
                <input
                  required
                  value={value.title}
                  placeholder={value.type === 'meeting' ? 'e.g. Weekly team sync' : value.type === 'brand-pitch' ? 'e.g. Pitch Ava to Lego' : 'What needs doing?'}
                  onChange={(e) => set({ title: e.target.value })}
                />
              </label>
              <label className="full">
                Creator (optional)
                <input list="calendar-creators" value={value.creatorName} onChange={(e) => setCreatorName(e.target.value)} />
              </label>
            </div>
          )}
          <datalist id="calendar-creators">
            {creators.map((c) => (
              <option key={c.id} value={fullName(c)} />
            ))}
          </datalist>

          <div className="formgrid">
            <label>
              {brand ? 'Outreach date' : 'Date'}
              <input type="date" required value={value.date} onChange={(e) => set({ date: e.target.value })} />
            </label>
            <label>
              <span>
                Time <span className="optional">· empty = all day</span>
              </span>
              <input type="time" value={value.time} onChange={(e) => set({ time: e.target.value })} />
            </label>
            {value.time && (
              <label>
                Length
                <select value={value.duration} onChange={(e) => set({ duration: Number(e.target.value) })}>
                  {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                    <option key={m} value={m}>
                      {m < 60 ? `${m} min` : `${m / 60} hour${m === 60 ? '' : 's'}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Reminder
              <select value={value.reminder} onChange={(e) => set({ reminder: e.target.value })}>
                {REMINDERS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Notes
            <textarea rows={3} value={value.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
          <label className="checkRow">
            <input type="checkbox" checked={value.done} onChange={(e) => set({ done: e.target.checked })} />
            Done
          </label>

          {error && <p className="error">{error}</p>}

          <div className="eventActions">
            {!isNew && !readOnly && (
              <button type="button" className="icon delete" aria-label="Delete from calendar" onClick={onDelete} disabled={busy}>
                <Trash2 size={17} />
              </button>
            )}
            {!validateEvent(value) && (
              <a className="guideLink" href={googleCalendarUrl(value)} target="_blank" rel="noreferrer">
                <CalendarPlus size={13} /> Add to Google Calendar ↗
              </a>
            )}
            <span className="spacer" />
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={busy || readOnly}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
