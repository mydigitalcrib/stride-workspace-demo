import { fileURLToPath as __toPath } from 'node:url';
const ROOT = process.argv[2] || __toPath(new URL('..', import.meta.url));
import { pathToFileURL } from 'node:url';
const c = await import(pathToFileURL(`${ROOT}/src/calendar.js`));

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n   got ${JSON.stringify(actual)}\n   want ${JSON.stringify(expected)}`}`);
};

// 2026-11-16 is a Monday, 2026-11-20 a Friday
check('weekday Monday', c.weekday('2026-11-16'), 0);
check('weekday Sunday', c.weekday('2026-11-22'), 6);
check('start of week from Wed', c.startOfWeek('2026-11-18'), '2026-11-16');
check('start of week from Sun', c.startOfWeek('2026-11-22'), '2026-11-16');
check('next Friday from Wed', c.nextFriday('2026-11-18'), '2026-11-20');
check('next Friday on Friday = same day', c.nextFriday('2026-11-20'), '2026-11-20');
check('next Friday from Saturday', c.nextFriday('2026-11-21'), '2026-11-27');
check('next Friday from Sunday', c.nextFriday('2026-11-22'), '2026-11-27');
check('add days across month', c.addDays('2026-11-30', 2), '2026-12-02');
check('add days across year', c.addDays('2026-12-31', 1), '2027-01-01');
check('week label same month', c.weekLabel('2026-11-16', 5), 'Nov 16 – 20, 2026');
check('week label across months', c.weekLabel('2026-11-30', 5), 'Nov 30 – Dec 4, 2026');
check('format time', [c.formatTime('09:05'), c.formatTime('13:30'), c.formatTime('00:00')], ['9:05 AM', '1:30 PM', '12:00 AM']);
check('sort: timed first', c.sortEvents([{ title: 'b', time: '' }, { title: 'a', time: '14:00' }, { title: 'c', time: '09:00' }]).map((e) => e.title), ['c', 'a', 'b']);

// labels & validation
check('brand outreach label', c.eventLabel({ type: 'brand-outreach', brand: 'Lego', creatorName: 'Ava Morgan' }), 'Lego for Ava Morgan');
const base = { ...c.EMPTY_EVENT, id: 'x', date: '2026-11-20' };
check('task needs title', c.validateEvent({ ...base, type: 'task' }), 'Give it a title.');
check('brand outreach needs creator', c.validateEvent({ ...base, type: 'brand-outreach', brand: 'Lego' }), 'Add the creator who asked for this brand.');
check('brand outreach needs brand', c.validateEvent({ ...base, type: 'brand-outreach', creatorName: 'Ava' }), 'Add the requested brand.');
check('valid brand outreach', c.validateEvent({ ...base, type: 'brand-outreach', creatorName: 'Ava', brand: 'Lego' }), null);
check('bad time', c.validateEvent({ ...base, title: 'x', time: '25:00' }), 'Enter a time like 09:30.');
check('bad date', c.validateEvent({ ...base, title: 'x', date: '2026-13-40' }), 'Pick a date.');

// creator sync
const creators = [
  { id: 'a', firstName: 'Ana', lastName: 'Lopez', niche: 'Travel', followUp: '2026-11-18', outreach: 'Contacted' },
  { id: 'b', firstName: 'Ben', lastName: 'Ng', followUp: '2026-11-19', outreach: 'Contract signed' },
  { id: 'c', firstName: 'Cara', lastName: 'Diaz', bookingStatus: 'Call booked', calendarStart: '2026-11-17T15:30' },
  { id: 'd', firstName: 'Dee', lastName: 'Ray', bookingStatus: 'Pending scheduling', calendarStart: '2026-11-17T15:30' },
];
const items = c.creatorItems(creators);
check('sync: follow-up + booked call only', items.map((i) => i.id), ['followup:a', 'call:c']);
check('sync: call locked with time', [items[1].locked, items[1].date, items[1].time], [true, '2026-11-17', '15:30']);
check('sync: finished creator follow-up skipped', items.some((i) => i.creatorId === 'b'), false);

// reminders (local time)
const ev = { ...base, id: 'r1', title: 'Pitch', time: '10:00', reminder: '15' };
check('reminder 15 min before', c.reminderAt(ev).toTimeString().slice(0, 5), '09:45');
check('all-day reminder at 9am', c.reminderAt({ ...ev, time: '', reminder: '0' }).toTimeString().slice(0, 5), '09:00');
check('day-before reminder', c.reminderAt({ ...ev, time: '', reminder: '1440' }).getDate(), 19);
check('done → no reminder', c.reminderAt({ ...ev, done: true }), null);
const now = new Date('2026-11-20T09:50:00');
const due = c.dueReminders([ev, { ...ev, id: 'r2', time: '11:00' }], now, {});
check('due now: only the 10:00 one', due.map((d) => d.event.id), ['r1']);
check('not shown twice', c.dueReminders([ev], now, { [due[0].key]: true }).length, 0);
check('stale (>12h) ignored', c.dueReminders([ev], new Date('2026-11-21T09:50:00'), {}).length, 0);

// export
const end = c.eventEnd({ ...ev, time: '23:30', duration: 60 });
check('end crosses midnight', end, { date: '2026-11-21', time: '00:30' });
const ics = c.toIcs([ev, { ...base, id: 'b1', type: 'brand-outreach', creatorName: 'Ava, Morgan', brand: 'Lego; Duplo', notes: 'line1\nline2', reminder: '1440' }], new Date('2026-11-11T12:00:00Z'));
check('ics has 2 events', (ics.match(/BEGIN:VEVENT/g) || []).length, 2);
check('ics timed start', ics.includes('DTSTART:20261120T100000'), true);
check('ics all-day start/end', ics.includes('DTSTART;VALUE=DATE:20261120') && ics.includes('DTEND;VALUE=DATE:20261121'), true);
check('ics escapes commas/semicolons/newlines', ics.includes('Ava\\, Morgan') && ics.includes('Lego\\; Duplo') && ics.includes('line1\\nline2'), true);
check('ics alarm', ics.includes('TRIGGER:-PT15M') && ics.includes('TRIGGER:-PT15H'), true);
check('ics uses CRLF and no line > 75', ics.split('\r\n').every((l) => l.length <= 75), true);
const g = new URL(c.googleCalendarUrl(ev));
check('google link dates', g.searchParams.get('dates'), '20261120T100000/20261120T103000');
check('google link title', g.searchParams.get('text'), 'Pitch');

// sample week
const sample = c.sampleEvents('2026-11-18');
check('sample: 11 items, Mon–Fri', [sample.length, sample[0].date, sample.at(-1).date], [11, '2026-11-16', '2026-11-20']);
check('sample: brand outreach on Friday', sample.filter((e) => e.type === 'brand-outreach').every((e) => c.weekday(e.date) === 4), true);
check('sample events are valid', sample.map((e) => c.validateEvent(e)).filter(Boolean), []);

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
