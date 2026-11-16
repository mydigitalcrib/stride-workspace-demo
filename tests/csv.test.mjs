import { fileURLToPath as __toPath } from 'node:url';
const ROOT = process.argv[2] || __toPath(new URL('..', import.meta.url));
import { pathToFileURL } from 'node:url';
const root = ROOT;
const { prepareImport, parseFollowers, creatorsToCsv } = await import(pathToFileURL(`${root}/src/csv.js`));
const { searchText, missingDetails, sampleCreators, plural, isUnderMinimum } = await import(pathToFileURL(`${root}/src/data.js`));

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n   got ${JSON.stringify(actual)}\n   want ${JSON.stringify(expected)}`}`);
};

check('48,200', parseFollowers('48,200'), '48200');
check('48.200', parseFollowers('48.200'), '48200');
check('12.5K', parseFollowers('12.5K'), '12500');
check('1,2k', parseFollowers('1,2k'), '1200');
check('1.2M', parseFollowers('1.2M'), '1200000');
check('1,234,567', parseFollowers('1,234,567'), '1234567');
check('"15000 followers"', parseFollowers('15000 followers'), '15000');
check('blank', parseFollowers(''), '');
check('abc', parseFollowers('abc'), null);

// Spreadsheet-style headers, blank statuses, comma follower counts, quoted cells.
const good = `First name,Last name,Email,Niche,Follower count,Approval status,Pipeline stage,Outreach notes
Ana,Lopez,ana@x.com,Travel,"48,200",,,"Loves ""slow travel"", hiking"
Ben,Ng,BEN@x.com,Food,1.750,Stride Suite referral,Contacted,
Cara,,cara@x.com,Fashion,12.5K,,,`;
const r1 = prepareImport(good, [{ email: 'ben@x.com' }], 'T');
check('good: no errors', r1.errors, []);
check('good: Ben skipped as duplicate (case-insensitive)', r1.duplicates, 1);
check('good: 2 records', r1.records.map((c) => c.firstName), ['Ana', 'Cara']);
check('good: followers normalised', r1.records.map((c) => c.followers), ['48200', '12500']);
check('good: blank statuses keep defaults', [r1.records[0].approval, r1.records[0].outreach], ['Needs review', 'Not yet contacted']);
check('good: quoted cell with comma + escaped quotes', r1.records[0].notes, 'Loves "slow travel", hiking');
check('good: Cara under minimum', isUnderMinimum(r1.records[1]), true);

const bad = `firstName,followers,approval,outreach
Dee,lots,,
,2000,,
Eve,20000,Maybe,Contacted`;
const r2 = prepareImport(bad, [], 'T');
check('bad: nothing imported', r2.records.length, 0);
check('bad: 3 row errors', r2.errors.length, 3);
console.log('   ' + r2.errors.join('\n   '));

check('no firstName column', prepareImport('name,email\nx,y', []).errors.length, 1);

// Round trip: export then re-import into an empty workspace.
const samples = sampleCreators();
const r3 = prepareImport(creatorsToCsv(samples), [], 'T');
check('round trip: no errors', r3.errors, []);
check('round trip: all 8 back', r3.records.length, 8);
check('round trip: re-import into same workspace = all duplicates except no-email', prepareImport(creatorsToCsv(samples), samples).records.length, 1);

// Search ignores field names.
const amelia = samples[0];
check('search "call" does not match by key', searchText(amelia).includes('call'), false);
check('search "lego" matches Ava brand', searchText(samples[7]).includes('lego'), true);
check('missing labels', missingDetails({ firstName: 'A' }), ['last name', 'email', 'niche', 'follower count', 'brand', 'collaboration date', 'owner', 'social link']);
check('sample complete count', samples.filter((c) => missingDetails(c).length === 0).length, 5);
check('plural', [plural(1, 'creator'), plural(2, 'creator')], ['1 creator', '2 creators']);

// Duplicates: the same social account is the same person; a shared studio email is not.
const shared = `firstName,email,instagram
Lisa,studio@x.example,https://www.instagram.com/hyphygrandma/
Molly,studio@x.example,https://www.instagram.com/mollywood.films/
Lisa again,other@x.example,https://instagram.com/HyphyGrandma
NoLink,studio@x.example,`;
const rs = prepareImport(shared, [], 'T');
check('shared email, different accounts → both kept', rs.records.map((c) => c.firstName), ['Lisa', 'Molly']);
check('same account (any case, any email) → duplicate; no-link row with known email → duplicate', rs.duplicates, 2);
const existing = [{ email: 'ana@x.example', instagram: '' }];
check(
  'existing creator without a link + same email with a link → duplicate',
  prepareImport('firstName,email,instagram\nAna,ANA@x.example,https://www.instagram.com/ana/', existing, 'T').duplicates,
  1,
);

// ---- Updating creators who are already in the workspace ----
const { planImport, applyImportPlan } = await import(pathToFileURL(`${ROOT}/src/csv.js`));
const { engagementRateFrom } = await import(pathToFileURL(`${ROOT}/src/data.js`));
const ana = { id: 'a1', firstName: 'Ana', lastName: 'Lopez', email: 'ana@x.example', instagram: 'https://www.instagram.com/ana/', outreach: 'Replied', approval: 'Needs review', engagementRate: '', engagementSource: '', engagementDate: '', followers: '20000', notes: 'keep me', history: ['old entry'] };
const sheet = `First Name,Instagram URL,ER,Followers,Status
Ana,https://instagram.com/Ana,3.4%,21000,Initial Email Sent
Newbie,https://instagram.com/newbie,2,30000,
,https://instagram.com/ghost,1.2,,`;
const plan = planImport(sheet, [ana], 'T');
check('plan: no errors (sheet "Status" column ignored)', plan.errors, []);
check('plan: Ana is an update with ER + followers', plan.updates.map((u) => u.values), [{ engagementRate: '3.4', followers: '21000' }]);
check('plan: one new creator', plan.newRecords.map((c) => c.firstName), ['Newbie']);
check('plan: unknown row without a name is skipped, not an error', plan.skippedNoName, [4]);
check('plan: field counts', plan.fieldCounts, { engagementRate: 1, followers: 1 });

const onlyEr = applyImportPlan(plan, { fields: ['engagementRate'], day: '2026-11-13', now: new Date('2026-11-13T12:00:00Z') });
const anaAfter = onlyEr.updated[0];
check('apply: only ticked field changes', [anaAfter.engagementRate, anaAfter.followers], ['3.4', '20000']);
check('apply: ER stamps date and source', [anaAfter.engagementDate, anaAfter.engagementSource], ['2026-11-13', 'Imported from CSV']);
check('apply: stage and notes untouched', [anaAfter.outreach, anaAfter.notes], ['Replied', 'keep me']);
check('apply: history records the update', anaAfter.history[0], '2026-11-13T12:00:00.000Z | Updated from CSV: engagementRate: — → 3.4');
check('apply: new creators added by default', onlyEr.added.map((c) => c.firstName), ['Newbie']);
check('apply: can skip new creators', applyImportPlan(plan, { addNew: false, fields: ['engagementRate'] }).added, []);
check('apply: nothing ticked → no updates', applyImportPlan(plan, { fields: [] }).updated, []);
check('blank cells never erase', planImport('First Name,Instagram URL,Followers\nAna,https://instagram.com/ana,', [ana], 'T').unchanged, 1);
const erOnly = planImport('Instagram URL,ER\nhttps://instagram.com/ana,5', [ana], 'T');
check('ER-only file (no name column) updates existing creators', [erOnly.errors.length, erOnly.updates.length], [0, 1]);
check('file with nothing to match on → error', planImport('ER\n5', [ana], 'T').errors.length, 1);
check('bad ER in an update → error, nothing planned', planImport('Instagram URL,ER\nhttps://instagram.com/ana,lots', [ana], 'T').errors.length, 1);

// ER formula
check('ER: 500 likes + 20 comments, 26,000 followers', engagementRateFrom(500, 20, 26000), '2');
check('ER: rounds to 2 decimals', engagementRateFrom('1,234', 56, 48200), '2.68');
check('ER: no followers → null', engagementRateFrom(100, 5, ''), null);
check('ER: no likes or comments → null', engagementRateFrom('', '', 10000), null);

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
