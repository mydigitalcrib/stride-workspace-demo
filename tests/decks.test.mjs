import { fileURLToPath as __toPath } from 'node:url';
const ROOT = process.argv[2] || __toPath(new URL('..', import.meta.url));
import { pathToFileURL } from 'node:url';
const root = ROOT;
const load = (f) => import(pathToFileURL(`${root}/src/${f}`));
const { chooseDeck, matchNicheDecks } = await load('decks.js');
const { rateFor, rateSummary, formatGBP } = await load('rates.js');
const { prepareImport, creatorsToCsv } = await load('csv.js');
const { personalise, sampleCreators, validateWorkflow, EMPTY_CREATOR } = await load('data.js');

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n   got ${JSON.stringify(actual)}\n   want ${JSON.stringify(expected)}`}`);
};
const deckFor = (niche, extra = {}) => chooseDeck({ niche, ...extra }).deck.id;

// Niche → deck
const cases = {
  'Motherhood & Family': 'family',
  'Mum life': 'family',
  'Personal finance': 'finance',
  'Dogs': 'pets',
  'Cats & kittens': 'pets',
  'Motorsport': 'racing',
  'Cars': 'racing',
  'F1': 'racing',
  'Plumbing': 'trades',
  'Tradie life': 'trades',
  'Modelling': 'modelling',
  'Music': 'music',
  'DJ': 'music',
  'Tech & Gaming': 'gaming-tech',
  'Gaming': 'gaming-tech',
  'AI': 'creative',
  'Graphic design': 'creative',
  'Web3': 'creative',
  'Travel': 'outdoors',
  'DIY': 'outdoors',
  'Gardening': 'outdoors',
  'Farm life': 'outdoors',
  'Running': 'sport',
  'Fitness': 'sport',
  'Podcasts': 'podcast',
  'Beauty & Skincare': 'beauty-fashion',
  'Fashion': 'beauty-fashion',
  'GRWM': 'beauty-fashion',
  // unclear → general Talent deck
  'Lifestyle': 'talent',
  'Food & Recipes': 'talent',
  'Movies & Pop Culture': 'talent',
  'Comedy': 'talent',
  '': 'talent',
  'Fitness & Fashion': 'talent', // fits two decks
  'Smart home': 'talent', // "art" must not match inside "smart"
  'Said things': 'talent', // "ai" must not match inside "said"
  'Careers': 'talent', // "car" must not match inside "careers"
};
for (const [niche, want] of Object.entries(cases)) check(`deck: "${niche}"`, deckFor(niche), want);
check('ambiguous lists both', matchNicheDecks('Fitness & Fashion').map((d) => d.id), ['sport', 'beauty-fashion']);
check('override wins', deckFor('Travel', { deckOverride: 'podcast' }), 'podcast');
check('override to talent wins over niche', deckFor('Travel', { deckOverride: 'talent' }), 'talent');
check('French', deckFor('Beauty', { deckLanguage: 'French' }), 'talent-fr');
check('German', deckFor('Beauty', { deckLanguage: 'German' }), 'talent-de');
check('reason text (unclear)', chooseDeck({ niche: 'Lifestyle' }).reason, 'No niche deck for “Lifestyle”, so this is the general Talent deck.');

// Rates (matches the live calculator: 12,345 views → £864.15 / £740.70 / £1,604.85)
check('IG 12345', formatGBP(rateFor('12345', 70)), '£864.15');
check('TT 12345', formatGBP(rateFor('12345', 60)), '£740.70');
check('YT 12345', formatGBP(rateFor('12345', 130)), '£1,604.85');
check('blank → null', rateFor('', 70), null);
check('summary', rateSummary({ viewsInstagram: '12345', viewsTiktok: '', viewsYoutube: '1000' }), 'IG £864 · YT £130');

// Personalisation
check('{{deckLink}}', personalise('See {{deckLink}}', { firstName: 'A', niche: 'Pets' }), 'See https://stridedecks.com/d/stride-pets');

// Validation
check('negative views rejected', validateWorkflow({ ...EMPTY_CREATOR, viewsTiktok: '-5' }), 'Average views must be a number of 0 or more.');
check('unknown deck rejected', validateWorkflow({ ...EMPTY_CREATOR, deckOverride: 'nope' }), 'Unknown signing deck.');

// CSV: friendly headers for views/deck/language, "12.5K" views, deck by name
const csv = `First name,Email,Niche,Instagram views,TikTok views,Deck,Language
Ana,ana@x.example,Lifestyle,12.5K,"3,000",Podcast Deck,english
Ben,ben@x.example,Fashion,,,,French`;
const r = prepareImport(csv, [], 'T');
check('csv: no errors', r.errors, []);
check('csv: views parsed', [r.records[0].viewsInstagram, r.records[0].viewsTiktok], ['12500', '3000']);
check('csv: deck by name', r.records[0].deckOverride, 'podcast');
check('csv: language normalised', [r.records[0].deckLanguage, r.records[1].deckLanguage], ['English', 'French']);
const bad = prepareImport('firstName,deck,deckLanguage,viewsYoutube\nX,Mystery deck,Spanish,lots', [], 'T');
check('csv: bad deck/language/views reported', bad.errors.length === 1 && ['deck “Mystery deck”', 'Spanish', 'lots'].every((s) => bad.errors[0].includes(s)), true);
const round = prepareImport(creatorsToCsv(sampleCreators()), [], 'T');
check('csv: sample round trip keeps views', round.records.map((c) => c.viewsInstagram), sampleCreators().map((c) => c.viewsInstagram));

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
