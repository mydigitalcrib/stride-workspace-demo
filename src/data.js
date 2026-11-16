// Business rules, defaults and helpers shared across the workspace.
import { DECK_LANGUAGES, ENGLISH_DECKS, chooseDeck } from './decks.js';

/** Minimum follower count for Stride Talent. Change it here and every label, filter and check follows. */
export const MIN_FOLLOWERS = 15000;
export const MIN_FOLLOWERS_LABEL = MIN_FOLLOWERS.toLocaleString('en-US'); // "15,000"
export const UNDER_MIN_FILTER = `Under ${MIN_FOLLOWERS_LABEL}`;

/** "Today" for follow-up due dates is counted in the team's time zone. */
export const TEAM_TIMEZONE = 'America/Argentina/Buenos_Aires';

export const DEFAULT_OWNER = 'Michelle';

/** Sent to creators who don't sign, or are under the minimum: joins the partnered creator network. */
export const PARTNERED_LINK = 'https://www.stride-suite.com/creator';
/** Sent to creators who signed: the Stride Talent onboarding form. */
export const ONBOARDING_LINK = 'https://www.stride-suite.com/signed-creator';

export const FIT_OPTIONS = ['Pending assessment', 'Good fit', 'Not a fit', 'Review later'];
export const BOOKING_OPTIONS = ['Pending scheduling', 'Time agreed — pending Calendar', 'Call booked', 'Cancelled'];
export const APPROVAL_OPTIONS = ['Needs review', 'Approved', 'Declined', 'Stride Suite referral'];
export const PIPELINE_STAGES = [
  'Not yet contacted',
  'Contacted',
  'Replied',
  'Meeting booked',
  'Call booked',
  'Call completed',
  'Contract sent',
  'Contract signed',
  'Signed',
  'Closed',
  'Follow-up needed',
];
/** Stages where nothing is left to follow up on. */
export const FINISHED_STAGES = ['Contract signed', 'Signed', 'Closed'];
/** Older stage names kept so existing records still display; hidden from the picker otherwise. */
export const LEGACY_STAGES = ['Signed', 'Meeting booked'];

export const WORKFLOW_DEFAULTS = {
  engagementRate: '',
  engagementSource: '',
  engagementDate: '',
  fit: 'Pending assessment',
  bookingStatus: 'Pending scheduling',
  calendarUrl: '',
  calendarEmail: '',
  calendarStart: '',
  calendarTimezone: TEAM_TIMEZONE,
  calendarChecked: '',
  gmailUrl: '',
  bookingNotes: '',
  handoffStatus: 'Not handed off',
  handoffUrl: '',
  partnerUrl: '',
  partnerStatus: 'Not sent',
  viewsInstagram: '',
  viewsTiktok: '',
  viewsYoutube: '',
  deckLanguage: 'English',
  deckOverride: '', // '' = pick the deck from the niche
  calls: [],
};

/** Average-view fields used by the pricing calculator. */
export const VIEW_FIELDS = ['viewsInstagram', 'viewsTiktok', 'viewsYoutube'];

export const EMPTY_CREATOR = {
  ...WORKFLOW_DEFAULTS,
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  niche: '',
  followers: '',
  brand: '',
  collabDate: '',
  approval: 'Needs review',
  reason: '',
  outreach: 'Not yet contacted',
  owner: DEFAULT_OWNER,
  followUp: '',
  notes: '',
  instagram: '',
  tiktok: '',
  history: [],
};

export const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-intro',
    title: 'Management introduction',
    body: `Hi {{firstName}},

I’m {{owner}}, a manager at Stride Talent. I came across your content and would love to connect about potential management opportunities. We help creators build meaningful brand partnerships and grow their careers.

Would you be open to a quick chat? I’d love to learn more about your goals and tell you about Stride.

Best,
{{owner}}`,
  },
  {
    id: 'tpl-follow',
    title: 'Friendly follow-up',
    body: `Hi {{firstName}},

I hope you’re having a lovely week! Just following up on my message about management opportunities with Stride Talent. I’d still love to connect whenever you have a moment.

Let me know if you’re interested, and we can find a time that works for you.

Best,
{{owner}}`,
  },
  {
    id: 'tpl-suite',
    title: 'Stride Suite invitation',
    body: `Hi {{firstName}},

Thank you for your interest in Stride! While Stride Talent currently requires a minimum of ${MIN_FOLLOWERS_LABEL} followers, we’d love to stay connected through Stride Suite, our separate creator partnership path.

You can explore joining here: ${PARTNERED_LINK}

We look forward to seeing your content grow!

Best,
{{owner}}`,
  },
];

export const FILTERS = [
  'All creators',
  'Missing information',
  UNDER_MIN_FILTER,
  'Not yet contacted',
  'Contacted',
  'Follow-up needed',
  'Approved',
  'Declined',
  'Stride Suite referral',
  'Call booked',
  'Call completed',
  'Contract sent',
  'Contract signed',
  'Pending assessment',
  'Good fit',
  'Not a fit',
  'Review later',
  'Stride Partner referral',
];

export const CALL_GUIDE_URL = import.meta.env?.VITE_DEMO === '1' ? 'guides/not-in-demo.html' : 'guides/running-a-creator-call.pdf';

/** Today's date (YYYY-MM-DD) in the team's time zone. */
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TEAM_TIMEZONE });

export const isDue = (c) => !!c.followUp && c.followUp <= today() && !FINISHED_STAGES.includes(c.outreach);

export const hasFollowerCount = (c) => c.followers !== '' && c.followers != null && Number.isFinite(Number(c.followers));
export const isUnderMinimum = (c) => hasFollowerCount(c) && Number(c.followers) < MIN_FOLLOWERS;

/**
 * Engagement rate (%) = (average likes + average comments per post) ÷ followers × 100,
 * rounded to 2 decimals. Returns null when the numbers can't give a rate.
 */
export function engagementRateFrom(avgLikes, avgComments, followers) {
  const likes = Number(String(avgLikes ?? '').replace(/[,\s]/g, '')) || 0;
  const comments = Number(String(avgComments ?? '').replace(/[,\s]/g, '')) || 0;
  const audience = Number(followers);
  if (!Number.isFinite(audience) || audience <= 0 || likes < 0 || comments < 0 || likes + comments === 0) return null;
  return String(Math.round(((likes + comments) / audience) * 10000) / 100);
}

export function formatFollowers(value) {
  if (value === '' || value == null) return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : String(value);
}

/** Readable names for the profile fields that count toward "enrichment". */
const ENRICHMENT_FIELDS = {
  firstName: 'first name',
  lastName: 'last name',
  email: 'email',
  niche: 'niche',
  followers: 'follower count',
  brand: 'brand',
  collabDate: 'collaboration date',
  owner: 'owner',
};

/** Returns the readable names of the details a profile is still missing. */
export function missingDetails(c) {
  const missing = Object.keys(ENRICHMENT_FIELDS)
    .filter((key) => !c[key])
    .map((key) => ENRICHMENT_FIELDS[key]);
  if (!c.instagram && !c.tiktok) missing.push('social link');
  return missing;
}

/** "1 creator" / "3 creators". */
export const plural = (n, singular, pluralForm = `${singular}s`) => `${n} ${n === 1 ? singular : pluralForm}`;

/** Fills {{firstName}}, {{owner}} and {{deckLink}} in a template body. */
export const personalise = (body, c) =>
  (body || '')
    .replaceAll('{{firstName}}', c.firstName || '[first name]')
    .replaceAll('{{owner}}', c.owner || '[your name]')
    .replaceAll('{{deckLink}}', chooseDeck(c).deck.url);

/** Text searched by the creator search box: field values only, never field names. */
export function searchText(c) {
  const values = [];
  for (const [key, value] of Object.entries(c)) {
    if (['id', 'history', 'calendarTimezone', 'deckLanguage', 'deckOverride'].includes(key)) continue;
    if (key === 'calls') {
      (value || []).forEach((call) =>
        Object.entries(call || {}).forEach(([callKey, callValue]) => {
          if (callKey !== 'id') values.push(callValue);
        }),
      );
    } else {
      values.push(value);
    }
  }
  return values.join(' ').toLowerCase();
}

/** Checks the call, scheduling and handoff fields. Returns an error message, or null when valid. */
export function validateWorkflow(c) {
  if (
    c.engagementRate !== undefined &&
    c.engagementRate !== '' &&
    (!Number.isFinite(Number(c.engagementRate)) || Number(c.engagementRate) < 0 || Number(c.engagementRate) > 100)
  )
    return 'Engagement rate must be between 0 and 100%.';
  for (const key of VIEW_FIELDS) {
    const views = c[key];
    if (views !== undefined && views !== '' && (!Number.isFinite(Number(views)) || Number(views) < 0))
      return 'Average views must be a number of 0 or more.';
  }
  if (c.deckLanguage && !DECK_LANGUAGES.includes(c.deckLanguage)) return 'Invalid deck language.';
  if (c.deckOverride && !ENGLISH_DECKS.some((d) => d.id === c.deckOverride)) return 'Unknown signing deck.';
  if (c.fit && !FIT_OPTIONS.includes(c.fit)) return 'Invalid fit status.';
  if (c.bookingStatus && !BOOKING_OPTIONS.includes(c.bookingStatus)) return 'Invalid booking status.';
  if (
    (c.bookingStatus === 'Call booked' || c.outreach === 'Call booked') &&
    (c.bookingStatus !== 'Call booked' ||
      !c.calendarUrl ||
      !c.calendarStart ||
      !c.calendarChecked ||
      !c.email ||
      c.calendarEmail?.trim().toLowerCase() !== c.email.trim().toLowerCase())
  )
    return 'Confirm a non-cancelled Google Calendar event with a matching creator email, date/time and check date before marking the call booked.';
  for (const key of ['calendarUrl', 'gmailUrl', 'handoffUrl', 'partnerUrl']) {
    if (!c[key]) continue;
    let url;
    try {
      url = new URL(c[key]);
    } catch {
      return 'Enter a valid https:// link.';
    }
    if (url.protocol !== 'https:') return 'Links must use https://';
    if (key === 'calendarUrl' && !['calendar.google.com', 'www.google.com'].includes(url.hostname))
      return 'Use a Google Calendar event link.';
    if (key === 'gmailUrl' && url.hostname !== 'mail.google.com') return 'Use a Gmail thread link.';
  }
  if (
    c.calls !== undefined &&
    (!Array.isArray(c.calls) || c.calls.some((call) => !call || typeof call.id !== 'string' || typeof call.date !== 'string'))
  )
    return 'Invalid call notes.';
  return null;
}

/** Fictional creators for the read-only "Explore sample data" preview. */
export function sampleCreators() {
  // [first, last, niche, followers, approval, stage, brand, engagement %, fit, has social link, [IG, TikTok, YouTube views]]
  const rows = [
    ['Amelia', 'Reed', 'Motherhood & Family', '48200', 'Approved', 'Contacted', 'Little Sprout', '4.8', 'Good fit', true, ['12000', '', '']],
    ['Sofia', 'Chen', 'Lifestyle', '126000', 'Needs review', 'Not yet contacted', 'Everlane', '', 'Pending assessment', false, ['', '', '']],
    ['Oliver', 'James', 'Food & Recipes', '18700', 'Approved', 'Follow-up needed', 'HelloFresh', '6.1', 'Good fit', true, ['', '25000', '']],
    ['Maya', 'Brooks', 'Beauty & Skincare', '1750', 'Stride Suite referral', 'Not yet contacted', '', '', 'Pending assessment', true, ['', '', '']],
    ['Isabella', 'Rose', 'Fashion', '92000', 'Approved', 'Replied', 'COS', '3.2', 'Good fit', true, ['30000', '18000', '']],
    ['Ethan', 'Park', 'Movies & Pop Culture', '', 'Needs review', 'Not yet contacted', '', '', 'Pending assessment', false, ['', '', '']],
    ['Luna', 'Rivera', 'Travel', '34600', 'Declined', 'Closed', 'Away', '1.1', 'Not a fit', true, ['', '', '9000']],
    ['Ava', 'Morgan', 'Motherhood & Family', '61300', 'Approved', 'Meeting booked', 'Lego', '5.4', 'Review later', true, ['15000', '', '']],
  ];
  const reasonFor = (approval) =>
    approval === 'Approved'
      ? 'Strong content and brand alignment'
      : approval === 'Declined'
        ? 'Current roster fit'
        : approval === 'Stride Suite referral'
          ? `Below ${MIN_FOLLOWERS_LABEL}-follower minimum`
          : '';
  return rows.map(([firstName, lastName, niche, followers, approval, outreach, brand, engagementRate, fit, social, views], i) => ({
    ...EMPTY_CREATOR,
    id: `demo-${i}`,
    firstName,
    lastName,
    email: i === 5 ? '' : `${firstName.toLowerCase()}@example.com`,
    niche,
    followers,
    approval,
    outreach,
    brand,
    collabDate: brand ? '2026-10-28' : '',
    reason: reasonFor(approval),
    followUp: [0, 2].includes(i) ? today() : '',
    engagementRate,
    engagementSource: engagementRate ? 'Average of last 12 posts' : '',
    fit,
    viewsInstagram: views[0],
    viewsTiktok: views[1],
    viewsYoutube: views[2],
    // .example is a reserved test domain, so these never point at a real account.
    instagram: social ? `https://instagram.example/${firstName.toLowerCase()}.${lastName.toLowerCase()}` : '',
    notes: 'Fictional sample creator. Explore the workflow, then switch to your workspace.',
    history: [],
  }));
}
