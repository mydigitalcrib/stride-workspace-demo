// My calendar: event types, date maths, creator sync, reminders and calendar export.
import { FINISHED_STAGES, TEAM_TIMEZONE, today } from './data.js';

export const EVENT_TYPES = [
  { id: 'task', name: 'Task', color: '#7f9282' },
  { id: 'meeting', name: 'Meeting', color: '#5b8cc9' },
  { id: 'creator-outreach', name: 'Creator outreach', color: '#3f8f6b' },
  { id: 'brand-pitch', name: 'Brand pitch', color: '#8a6fc0' },
  { id: 'follow-up', name: 'Follow-up', color: '#d0904a' },
  { id: 'brand-outreach', name: 'Brand outreach', color: '#c0587e' },
];
export const typeOf = (id) => EVENT_TYPES.find((t) => t.id === id) || EVENT_TYPES[0];

/** Brand outreach progress, in order. */
export const OUTREACH_STATUSES = ['Requested', 'Contacted', 'Follow-up sent', 'Replied', 'Deal agreed', 'Declined'];
export const STATUS_TONES = {
  Requested: 'gray',
  Contacted: 'blue',
  'Follow-up sent': 'orange',
  Replied: 'purple',
  'Deal agreed': 'green',
  Declined: 'red',
};

export const REMINDERS = [
  ['', 'No reminder'],
  ['0', 'At the start time'],
  ['15', '15 minutes before'],
  ['60', '1 hour before'],
  ['1440', '1 day before'],
];

export const EMPTY_EVENT = {
  id: '',
  type: 'task',
  title: '',
  date: '',
  time: '', // 'HH:MM', or '' for all day
  duration: 30, // minutes
  notes: '',
  done: false,
  reminder: '',
  // brand outreach
  creatorId: '',
  creatorName: '',
  niche: '',
  brand: '',
  status: 'Requested',
};

/** Where the calendar's view settings (weekend, creator items) are saved. */
export const CALENDAR_PREFS_KEY = 'stride-talent-workspace:calendar-prefs:v1';

/** Friday is Brand Outreach day. Days are numbered from Monday = 0. */
export const BRAND_OUTREACH_DAY = 4;

// ---- dates (YYYY-MM-DD strings, timezone-safe) ----

const toUTC = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUTC = (dt) => dt.toISOString().slice(0, 10);
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && fromUTC(toUTC(s)) === s; // rejects 2026-13-40
export const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
export const addDays = (s, n) => {
  const d = toUTC(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
};
/** 0 = Monday … 6 = Sunday */
export const weekday = (s) => (toUTC(s).getUTCDay() + 6) % 7;
export const startOfWeek = (s) => addDays(s, -weekday(s));
/** The coming Friday (today, if it's Friday). */
export const nextFriday = (s) => {
  const wd = weekday(s);
  return addDays(s, wd <= BRAND_OUTREACH_DAY ? BRAND_OUTREACH_DAY - wd : 7 + BRAND_OUTREACH_DAY - wd);
};
export const formatDate = (s, options) => toUTC(s).toLocaleDateString('en-US', { timeZone: 'UTC', ...options });

/** "Nov 16 – 20, 2026" or "Nov 30 – Dec 4, 2026" */
export function weekLabel(start, days) {
  const end = addDays(start, days - 1);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${formatDate(start, { month: 'short', day: 'numeric' })} – ${formatDate(end, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}, ${end.slice(0, 4)}`;
}

/** "9:30 AM" */
export function formatTime(t) {
  if (!isTime(t)) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Timed items first (by time), then all-day items. */
export const sortEvents = (list) =>
  [...list].sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || eventLabel(a).localeCompare(eventLabel(b)));

export function eventLabel(e) {
  if (e.title?.trim()) return e.title.trim();
  if (e.type === 'brand-outreach') return `${e.brand || 'Brand'} for ${e.creatorName || 'a creator'}`;
  return typeOf(e.type).name;
}

export function eventDescription(e) {
  const lines = [];
  if (e.type === 'brand-outreach') {
    lines.push(`Creator: ${e.creatorName || '—'}${e.niche ? ` (${e.niche})` : ''}`, `Requested brand: ${e.brand || '—'}`, `Status: ${e.status}`);
  } else if (e.creatorName) {
    lines.push(`Creator: ${e.creatorName}`);
  }
  if (e.notes?.trim()) lines.push('', e.notes.trim());
  return lines.join('\n');
}

/** Returns an error message, or null when the event can be saved. */
export function validateEvent(e) {
  if (!EVENT_TYPES.some((t) => t.id === e.type)) return 'Pick a type.';
  if (!isDate(e.date)) return 'Pick a date.';
  if (e.time && !isTime(e.time)) return 'Enter a time like 09:30.';
  if (e.type === 'brand-outreach') {
    if (!e.creatorName?.trim()) return 'Add the creator who asked for this brand.';
    if (!e.brand?.trim()) return 'Add the requested brand.';
    if (!OUTREACH_STATUSES.includes(e.status)) return 'Pick a status.';
  } else if (!e.title?.trim()) {
    return 'Give it a title.';
  }
  if (!REMINDERS.some(([value]) => value === String(e.reminder ?? ''))) return 'Pick a reminder.';
  const duration = Number(e.duration);
  if (e.time && (!Number.isFinite(duration) || duration < 5 || duration > 24 * 60)) return 'Length must be between 5 minutes and 24 hours.';
  return null;
}

// ---- items that come from creator profiles ----

/**
 * Follow-up dates and booked calls from creator profiles, shown on the calendar automatically.
 * Follow-ups can be dragged to a new day (which updates the creator); booked calls can't.
 */
export function creatorItems(creators) {
  return creators.flatMap((c) => {
    const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'creator';
    const items = [];
    if (isDate(c.followUp) && !FINISHED_STAGES.includes(c.outreach)) {
      items.push({
        ...EMPTY_EVENT,
        id: `followup:${c.id}`,
        source: 'follow-up',
        creatorId: c.id,
        type: 'follow-up',
        title: `Follow up with ${name}`,
        date: c.followUp,
        creatorName: name,
        niche: c.niche || '',
      });
    }
    const start = String(c.calendarStart || '');
    if (c.bookingStatus === 'Call booked' && isDate(start.slice(0, 10)) && isTime(start.slice(11, 16))) {
      items.push({
        ...EMPTY_EVENT,
        id: `call:${c.id}`,
        source: 'call',
        locked: true,
        creatorId: c.id,
        type: 'meeting',
        title: `Call with ${name}`,
        date: start.slice(0, 10),
        time: start.slice(11, 16),
        creatorName: name,
        niche: c.niche || '',
      });
    }
    return items;
  });
}

// ---- reminders ----

/** When the reminder for an event should go off (in this browser's time), or null. */
export function reminderAt(e) {
  if (e.done || e.reminder === '' || e.reminder == null || !isDate(e.date)) return null;
  const minutes = Number(e.reminder);
  if (!e.time) {
    // all-day items: 9 AM on the day, or 9 AM the day before
    const morning = new Date(`${e.date}T09:00:00`);
    return minutes >= 1440 ? new Date(morning.getTime() - 86_400_000) : morning;
  }
  return new Date(new Date(`${e.date}T${e.time}:00`).getTime() - minutes * 60_000);
}

/** Reminders that are due now and haven't been shown yet (ignores ones more than 12 hours old). */
export function dueReminders(events, now, alreadyShown) {
  return events.flatMap((e) => {
    const at = reminderAt(e);
    if (!at) return [];
    const key = `${e.id}@${at.toISOString()}`;
    const age = now.getTime() - at.getTime();
    return age >= 0 && age < 12 * 3_600_000 && !alreadyShown[key] ? [{ event: e, key }] : [];
  });
}

// ---- export to other calendars ----

const compact = (date, time) => date.replace(/-/g, '') + (time ? `T${time.replace(':', '')}00` : '');

export function eventEnd(e) {
  if (!e.time) return { date: addDays(e.date, 1), time: '' };
  const [h, m] = e.time.split(':').map(Number);
  const total = h * 60 + m + (Number(e.duration) || 30);
  const mins = total % 1440;
  return { date: addDays(e.date, Math.floor(total / 1440)), time: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` };
}

/** A link that opens Google Calendar with this event filled in, ready to save. */
export function googleCalendarUrl(e) {
  const end = eventEnd(e);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventLabel(e),
    dates: e.time ? `${compact(e.date, e.time)}/${compact(end.date, end.time)}` : `${compact(e.date)}/${compact(end.date)}`,
    details: eventDescription(e),
  });
  if (e.time) params.set('ctz', TEAM_TIMEZONE);
  return `https://calendar.google.com/calendar/render?${params}`;
}

const icsText = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
const fold = (line) => {
  const parts = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
};

/** An .ics calendar file that Google Calendar, Outlook and Apple Calendar can import. */
export function toIcs(events, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stride Talent//Creator Workspace//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Stride Talent · My calendar',
  ];
  for (const e of events) {
    const end = eventEnd(e);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@stride-talent-workspace`,
      `DTSTAMP:${stamp}`,
      e.time ? `DTSTART:${compact(e.date, e.time)}` : `DTSTART;VALUE=DATE:${compact(e.date)}`,
      e.time ? `DTEND:${compact(end.date, end.time)}` : `DTEND;VALUE=DATE:${compact(end.date)}`,
      `SUMMARY:${icsText(eventLabel(e))}`,
      `CATEGORIES:${icsText(typeOf(e.type).name)}`,
    );
    const description = eventDescription(e);
    if (description) lines.push(`DESCRIPTION:${icsText(description)}`);
    if (!e.done && e.reminder !== '' && e.reminder != null) {
      const minutes = Number(e.reminder);
      const trigger = e.time ? `-PT${minutes}M` : minutes >= 1440 ? '-PT15H' : 'PT9H';
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(eventLabel(e))}`, `TRIGGER:${trigger}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

// ---- sample week (for "Explore sample data") ----

export function sampleEvents(base = today()) {
  const monday = startOfWeek(base);
  const day = (n) => addDays(monday, n);
  const e = (id, n, type, title, extra = {}) => ({ ...EMPTY_EVENT, id: `demo-ev-${id}`, type, title, date: day(n), ...extra });
  return [
    e(1, 0, 'task', 'Content reviews', { time: '10:00', duration: 60, done: true }),
    e(2, 0, 'meeting', 'Creator feedback', { time: '15:00', reminder: '15', done: true }),
    e(3, 1, 'creator-outreach', 'Talent scouting', { notes: 'Look for 15k+ creators in Pets and Travel.' }),
    e(4, 1, 'creator-outreach', 'Creator outreach', { time: '11:30', duration: 45 }),
    e(5, 2, 'creator-outreach', 'Creator outbound', { time: '09:30', duration: 90 }),
    e(6, 3, 'follow-up', 'Follow-ups', { time: '10:00' }),
    e(7, 3, 'brand-pitch', 'Partnerships', { time: '14:00', duration: 60, reminder: '60' }),
    e(8, 4, 'brand-outreach', '', {
      creatorName: 'Ava Morgan',
      niche: 'Motherhood & Family',
      brand: 'Lego',
      status: 'Contacted',
      notes: 'Ava would love a holiday build series.',
    }),
    e(9, 4, 'brand-outreach', '', {
      creatorName: 'Oliver James',
      niche: 'Food & Recipes',
      brand: 'HelloFresh',
      status: 'Requested',
      notes: 'Wants a recurring recipe partnership.',
    }),
    e(10, 4, 'task', 'Trend report', { time: '12:00' }),
    e(11, 4, 'task', 'Analytics', { time: '16:00' }),
  ];
}
