// CSV export and import for the creator list.
import { APPROVAL_OPTIONS, EMPTY_CREATOR, PIPELINE_STAGES, VIEW_FIELDS, today, validateWorkflow } from './data.js';
import { DECK_LANGUAGES, findDeck } from './decks.js';

/** Column order used for export, and the columns import understands. */
export const CSV_COLUMNS = Object.keys(EMPTY_CREATOR).filter((key) => key !== 'history');

const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function creatorsToCsv(creators) {
  const rows = creators.map((c) =>
    CSV_COLUMNS.map((key) => (key === 'calls' ? JSON.stringify(c.calls || []) : c[key] ?? '')),
  );
  return [CSV_COLUMNS, ...rows].map((row) => row.map(quote).join(',')).join('\r\n');
}

export function downloadCsv(text, filename, type = 'text/csv') {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Splits CSV text into rows of cells. Handles quoted cells, escaped quotes and CRLF line endings. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const endRow = () => {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
    row = [];
    cell = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += ch;
    }
  }
  endRow();
  return rows;
}

const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// Accept the exact field names from Export CSV, plus the labels people type in a spreadsheet.
const HEADER_LOOKUP = Object.fromEntries(CSV_COLUMNS.map((key) => [squash(key), key]));
Object.assign(HEADER_LOOKUP, {
  followercount: 'followers',
  follower: 'followers',
  collaborationdate: 'collabDate',
  followupdate: 'followUp',
  assignedowner: 'owner',
  approvalstatus: 'approval',
  pipelinestage: 'outreach',
  outreachstatus: 'outreach',
  stage: 'outreach',
  engagement: 'engagementRate',
  creatorfit: 'fit',
  decisionreason: 'reason',
  outreachnotes: 'notes',
  emailaddress: 'email',
  instagramviews: 'viewsInstagram',
  averageinstagramviews: 'viewsInstagram',
  avginstagramviews: 'viewsInstagram',
  tiktokviews: 'viewsTiktok',
  averagetiktokviews: 'viewsTiktok',
  avgtiktokviews: 'viewsTiktok',
  youtubeviews: 'viewsYoutube',
  averageyoutubeviews: 'viewsYoutube',
  avgyoutubeviews: 'viewsYoutube',
  language: 'deckLanguage',
  deck: 'deckOverride',
  signingdeck: 'deckOverride',
  instagramurl: 'instagram',
  instagramlink: 'instagram',
  instagramprofile: 'instagram',
  igurl: 'instagram',
  tiktokurl: 'tiktok',
  tiktoklink: 'tiktok',
  tiktokprofile: 'tiktok',
  er: 'engagementRate',
  ersource: 'engagementSource',
  erdate: 'engagementDate',
  erchecked: 'engagementDate',
});

const resolveHeader = (header) => HEADER_LOOKUP[squash(header.replace(/^﻿/, ''))] || null;

/**
 * Turns "48,200", "48.200", "12.5K" or "1.2M" into a whole number string.
 * Returns '' for an empty value and null when the value isn't a number.
 */
export function parseFollowers(raw) {
  let s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/followers?|\s/g, '');
  if (!s) return '';
  let multiplier = 1;
  const suffix = s.match(/[km]$/);
  if (suffix) {
    multiplier = suffix[0] === 'k' ? 1e3 : 1e6;
    s = s.slice(0, -1);
  }
  if (multiplier === 1 && /^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, ''); // thousands separators
  else s = s.replace(',', '.'); // decimal comma, e.g. "1,2k"
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return String(Math.round(Number(s) * multiplier));
}

/** "4.8%", "4,8" → "4.8". Returns '' when empty and null when not a number. */
function parsePercent(raw) {
  const s = String(raw ?? '').trim().replace('%', '').replace(',', '.').trim();
  if (!s) return '';
  return /^\d+(\.\d+)?$/.test(s) ? s : null;
}

/** The Instagram or TikTok account name from a profile link, lowercased ('' if none). */
export function socialHandle(c) {
  for (const link of [c.instagram, c.tiktok]) {
    const match = String(link || '').match(/(?:instagram\.com|tiktok\.com)\/@?([^/?#\s]+)/i);
    if (match) return match[1].toLowerCase();
  }
  return '';
}

/**
 * Finds who's already known. The same person is: the same Instagram/TikTok account, or the same
 * email when one of the two has no social link. Two different accounts that share an email
 * (a studio or manager inbox) count as different creators.
 */
function creatorFinder(creators = []) {
  const byHandle = new Map();
  const byEmail = new Map(); // email → [{ handle, creator }]
  const add = (c) => {
    const handle = socialHandle(c);
    const email = (c.email || '').trim().toLowerCase();
    if (handle && !byHandle.has(handle)) byHandle.set(handle, c);
    if (email) byEmail.set(email, [...(byEmail.get(email) || []), { handle, creator: c }]);
  };
  /** The known creator this one is the same person as, or null. */
  const match = (c) => {
    const handle = socialHandle(c);
    const email = (c.email || '').trim().toLowerCase();
    if (handle && byHandle.has(handle)) return byHandle.get(handle);
    const seen = email ? byEmail.get(email) : null;
    if (!seen) return null;
    if (!handle) return seen[0].creator;
    return seen.find((s) => !s.handle)?.creator || null;
  };
  creators.forEach(add);
  return { add, match };
}

/** True when two values mean the same thing (same social account, same email in any case). */
function sameValue(key, a, b) {
  if (key === 'instagram' || key === 'tiktok') {
    const handle = (link) => String(link || '').match(/(?:instagram\.com|tiktok\.com)\/@?([^/?#\s]+)/i)?.[1]?.toLowerCase() || String(link || '').trim();
    return handle(a) === handle(b);
  }
  if (key === 'email') return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  return String(a ?? '') === String(b ?? '');
}

/** Columns that can update a creator who's already in the workspace (notes and call notes never are). */
export const UPDATABLE_FIELDS = CSV_COLUMNS.filter((key) => !['id', 'calls', 'notes'].includes(key));
/** Ticked by default when updating existing creators: the numbers that go stale. */
export const DEFAULT_UPDATE_FIELDS = ['engagementRate', 'engagementSource', 'engagementDate', 'followers', 'viewsInstagram', 'viewsTiktok', 'viewsYoutube'];

/** Reads one row into a creator, checking each value. `present` lists the columns that had a value. */
function rowToCreator(columns, cells, importedAt) {
  const c = { ...EMPTY_CREATOR, id: crypto.randomUUID(), calls: [], history: [`${importedAt} | Imported from CSV`] };
  const present = [];
  columns.forEach((key, col) => {
    if (!key || key === 'id' || key === 'history') return;
    const value = (cells[col] ?? '').trim();
    if (value === '') return;
    c[key] = value;
    present.push(key);
  });

  const problems = [];
  const followers = parseFollowers(c.followers);
  if (followers === null) problems.push(`follower count “${c.followers}” isn’t a number`);
  else c.followers = followers;

  for (const key of VIEW_FIELDS) {
    const views = parseFollowers(c[key]);
    if (views === null) problems.push(`average views “${c[key]}” isn’t a number`);
    else c[key] = views;
  }

  if (c.deckOverride) {
    const deck = findDeck(c.deckOverride);
    // French/German decks are picked with the language column, not here.
    if (deck && !deck.id.startsWith('talent-')) c.deckOverride = deck.id;
    else problems.push(`deck “${c.deckOverride}” isn’t one of the signing decks`);
  }
  const language = DECK_LANGUAGES.find((l) => l.toLowerCase() === String(c.deckLanguage).toLowerCase());
  if (language) c.deckLanguage = language;
  else problems.push(`deck language “${c.deckLanguage}” should be English, French or German`);

  const engagement = parsePercent(c.engagementRate);
  if (engagement === null) problems.push(`engagement rate “${c.engagementRate}” isn’t a number`);
  else c.engagementRate = engagement;

  if (typeof c.calls === 'string') {
    try {
      c.calls = JSON.parse(c.calls);
    } catch {
      problems.push('the calls column isn’t valid (leave it empty or use the value from Export CSV)');
      c.calls = [];
    }
  }
  return { creator: c, present, problems };
}

function statusProblems(c) {
  const problems = [];
  if (!APPROVAL_OPTIONS.includes(c.approval)) problems.push(`approval “${c.approval}” should be one of: ${APPROVAL_OPTIONS.join(', ')}`);
  if (!PIPELINE_STAGES.includes(c.outreach)) problems.push(`stage “${c.outreach}” should be one of: ${PIPELINE_STAGES.join(', ')}`);
  if (!problems.length) {
    const workflow = validateWorkflow(c);
    if (workflow) problems.push(workflow);
  }
  return problems;
}

/**
 * Reads a CSV file and works out what importing it would do, without saving anything:
 * new creators to add, creators already in the workspace whose details the file would change,
 * and any problems. If any row has a problem, `errors` lists them and nothing should be imported.
 */
export function planImport(text, existingCreators, importedAt = new Date().toISOString()) {
  const rows = parseCsv(text);
  const columns = (rows.shift() || []).map(resolveHeader);
  const hasNameColumn = columns.includes('firstName');
  const canMatch = ['email', 'instagram', 'tiktok'].some((key) => columns.includes(key));
  const plan = { newRecords: [], updates: [], unchanged: 0, duplicatesInFile: 0, skippedNoName: [], errors: [], hasNameColumn, fieldCounts: {} };
  if (!hasNameColumn && !canMatch) {
    plan.errors.push('The file needs a first name column, or an email or Instagram column to find creators who are already in your workspace.');
    return plan;
  }

  const existing = creatorFinder(existingCreators);
  const inFile = creatorFinder();

  rows.forEach((cells, index) => {
    const line = index + 2; // +1 for the header, +1 because spreadsheets count from 1
    const { creator, present, problems } = rowToCreator(columns, cells, importedAt);
    if (inFile.match(creator)) {
      plan.duplicatesInFile++;
      return;
    }
    const match = existing.match(creator);

    if (match) {
      const values = {};
      for (const key of present) if (UPDATABLE_FIELDS.includes(key) && !sameValue(key, match[key], creator[key])) values[key] = creator[key];
      problems.push(...statusProblems({ ...EMPTY_CREATOR, ...match, ...values }));
      if (problems.length) {
        plan.errors.push(`Row ${line}: ${problems.join('; ')}`);
        return;
      }
      inFile.add(creator);
      if (!Object.keys(values).length) {
        plan.unchanged++;
        return;
      }
      plan.updates.push({ existing: match, values });
      Object.keys(values).forEach((key) => (plan.fieldCounts[key] = (plan.fieldCounts[key] || 0) + 1));
      return;
    }

    if (!creator.firstName) {
      if (problems.length) plan.errors.push(`Row ${line}: ${problems.join('; ')}`);
      else plan.skippedNoName.push(line);
      return;
    }
    problems.push(...statusProblems(creator));
    if (problems.length) {
      plan.errors.push(`Row ${line}: ${problems.join('; ')}`);
      return;
    }
    inFile.add(creator);
    plan.newRecords.push(creator);
  });
  return plan;
}

/**
 * Turns a plan into records to save. `fields` are the columns allowed to change existing creators.
 * Updating the engagement rate also stamps today's date (and a source, if there is none).
 */
export function applyImportPlan(plan, { addNew = true, fields = [], now = new Date(), day = today() } = {}) {
  const stamp = now.toISOString();
  const updated = [];
  for (const { existing, values } of plan.updates) {
    const chosen = Object.fromEntries(Object.entries(values).filter(([key]) => fields.includes(key)));
    if (!Object.keys(chosen).length) continue;
    const record = { ...existing, ...chosen };
    if ('engagementRate' in chosen) {
      if (!('engagementDate' in chosen)) record.engagementDate = day;
      if (!record.engagementSource) record.engagementSource = 'Imported from CSV';
    }
    const summary = Object.keys(chosen)
      .map((key) => `${key}: ${existing[key] || '—'} → ${chosen[key]}`)
      .join(' · ');
    record.history = [`${stamp} | Updated from CSV: ${summary}`, ...(existing.history || [])].slice(0, 100);
    updated.push(record);
  }
  return { added: addNew ? plan.newRecords : [], updated };
}

/**
 * The original all-or-nothing import check (new creators only), kept for compatibility:
 * creators already in the workspace count as duplicates, and a row without a first name is a problem.
 */
export function prepareImport(text, existingCreators, importedAt = new Date().toISOString()) {
  const plan = planImport(text, existingCreators, importedAt);
  if (!plan.hasNameColumn && !plan.errors.length) {
    return {
      records: [],
      duplicates: 0,
      errors: ['The file needs a first name column (“firstName” or “First name”). Use Export CSV to get a file with every supported column.'],
    };
  }
  const errors = [...plan.errors, ...plan.skippedNoName.map((line) => `Row ${line}: first name is empty`)].sort(
    (a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]),
  );
  return { records: plan.newRecords, errors, duplicates: plan.updates.length + plan.unchanged + plan.duplicatesInFile };
}
