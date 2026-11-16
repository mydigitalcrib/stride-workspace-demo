// Signing decks from https://stride-education.com/signing-decks, and how a creator's niche picks one.

export const SIGNING_DECKS_PAGE = 'https://stride-education.com/signing-decks';
export const DECK_LANGUAGES = ['English', 'French', 'German'];

/** The general deck: used when the niche is empty, matches no niche deck, or matches more than one. */
export const TALENT_DECK = {
  id: 'talent',
  name: '2026 Signing Deck',
  short: 'Talent (general)',
  url: 'https://stridedecks.com/d/stride-talent-signing-deck',
};

/** French and German each have one general deck (no niche versions). */
export const LANGUAGE_DECKS = {
  French: { id: 'talent-fr', name: 'Stride Talent France Deck', short: 'Talent (French)', url: 'https://stridedecks.com/d/stride-talent-france' },
  German: { id: 'talent-de', name: 'Stride Talent Germany Deck', short: 'Talent (German)', url: 'https://stridedecks.com/d/stride-talent-germany' },
};

/**
 * English niche decks. A niche matches a deck when it contains one of the deck's keywords
 * as a whole word (plurals included). Add keywords here to teach it new niches.
 */
export const NICHE_DECKS = [
  {
    id: 'family',
    name: 'Stride Family & Motherhood',
    short: 'Family & Motherhood',
    url: 'https://stridedecks.com/d/family-and-motherhood-talent',
    keywords: ['family', 'families', 'mother', 'motherhood', 'mom', 'mum', 'mama', 'parent', 'parenting', 'parenthood', 'baby', 'babies', 'pregnancy', 'pregnant', 'kid', 'toddler', 'dad', 'father', 'fatherhood'],
  },
  {
    id: 'finance',
    name: 'Stride Finance Deck',
    short: 'Finance',
    url: 'https://stridedecks.com/d/finance-talent',
    keywords: ['finance', 'financial', 'money', 'investing', 'investment', 'investor', 'budget', 'budgeting', 'saving', 'stock', 'stock market', 'wealth', 'real estate', 'property', 'side hustle'],
  },
  {
    id: 'pets',
    name: 'Stride Pets Deck',
    short: 'Pets',
    url: 'https://stridedecks.com/d/stride-pets',
    keywords: ['pet', 'dog', 'puppy', 'puppies', 'cat', 'kitten', 'animal'],
  },
  {
    id: 'racing',
    name: 'Stride Racing Deck',
    short: 'Racing',
    url: 'https://stridedecks.com/d/motor-sports',
    keywords: ['racing', 'race car', 'motorsport', 'motor sport', 'car', 'automotive', 'f1', 'formula 1', 'formula one', 'motorbike', 'motorcycle', 'karting', 'drifting'],
  },
  {
    id: 'trades',
    name: 'Stride Trades Deck',
    short: 'Trades',
    url: 'https://stridedecks.com/d/trade-creators',
    keywords: ['trade', 'tradesman', 'tradesperson', 'tradie', 'construction', 'plumbing', 'plumber', 'electrician', 'carpentry', 'carpenter', 'builder', 'welding', 'welder', 'roofing', 'roofer', 'mechanic'],
  },
  {
    id: 'modelling',
    name: 'Stride Model Deck',
    short: 'Modelling',
    url: 'https://stridedecks.com/d/stride-modelling',
    keywords: ['model', 'modelling', 'modeling'],
  },
  {
    id: 'music',
    name: 'Stride Music Deck',
    short: 'Music',
    url: 'https://stridedecks.com/d/stridemusic',
    keywords: ['music', 'musician', 'singer', 'singing', 'songwriter', 'dj', 'band', 'rapper'],
  },
  {
    id: 'gaming-tech',
    name: 'Tech & Gaming Deck',
    short: 'Gaming & Tech',
    url: 'https://stridedecks.com/d/gaming-tech-talent',
    keywords: ['gaming', 'gamer', 'game', 'esport', 'e-sport', 'tech', 'technology', 'gadget', 'streamer', 'coding', 'programming', 'software'],
  },
  {
    id: 'creative',
    name: 'AI, Web3 & Graphic Design Deck',
    short: 'Creative (AI, web3, design)',
    url: 'https://stridedecks.com/d/creative-talent',
    keywords: ['ai', 'artificial intelligence', 'web3', 'crypto', 'nft', 'blockchain', 'graphic design', 'graphic designer', 'design', 'designer', 'illustration', 'illustrator', 'digital art', 'art', 'animation'],
  },
  {
    id: 'outdoors',
    name: 'Outdoor Talent Deck',
    short: 'Outdoors (DIY, gardening, travel…)',
    url: 'https://stridedecks.com/d/outdoor-talent',
    keywords: ['outdoor', 'outdoor living', 'diy', 'gardening', 'garden', 'wildlife', 'nature', 'travel', 'traveller', 'traveler', 'farming', 'farm', 'farmer', 'farm life', 'homestead', 'homesteading', 'camping', 'hiking', 'fishing', 'hunting', 'van life', 'vanlife', 'adventure', 'home improvement', 'renovation'],
  },
  {
    id: 'sport',
    name: 'Stride Sport Deck',
    short: 'Sport',
    url: 'https://stridedecks.com/d/stride-sport-talent',
    keywords: ['sport', 'athlete', 'athletic', 'athletics', 'running', 'runner', 'marathon', 'fitness', 'gym', 'workout', 'football', 'soccer', 'basketball', 'tennis', 'golf', 'cycling', 'boxing', 'mma', 'rugby', 'cricket', 'swimming', 'yoga'],
  },
  {
    id: 'podcast',
    name: 'Podcast Deck',
    short: 'Podcasts',
    url: 'https://stridedecks.com/d/stride-podcast-talent',
    keywords: ['podcast', 'podcaster', 'podcasting'],
  },
  {
    id: 'beauty-fashion',
    name: 'Beauty & Fashion Deck',
    short: 'Beauty & Fashion',
    url: 'https://stridedecks.com/d/beauty-fashion-talent',
    keywords: ['beauty', 'fashion', 'skincare', 'skin care', 'makeup', 'make-up', 'cosmetics', 'style', 'styling', 'stylist', 'hair', 'haircare', 'nails', 'outfit', 'grwm'],
  },
];

/** Decks that can be picked by hand for an English-language creator. */
export const ENGLISH_DECKS = [TALENT_DECK, ...NICHE_DECKS];
export const ALL_DECKS = [...ENGLISH_DECKS, ...Object.values(LANGUAGE_DECKS)];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = new Map(
  NICHE_DECKS.map((deck) => [deck.id, new RegExp(`\\b(?:${deck.keywords.map(escape).join('|')})(?:s|es)?\\b`, 'i')]),
);

/** Niche decks whose keywords appear in the niche text. */
export function matchNicheDecks(niche) {
  if (!niche?.trim()) return [];
  return NICHE_DECKS.filter((deck) => patterns.get(deck.id).test(niche));
}

/** Finds a deck by id or by name (used by CSV import). */
export function findDeck(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return null;
  return ALL_DECKS.find((d) => d.id === v || d.name.toLowerCase() === v || d.short.toLowerCase() === v) || null;
}

/**
 * Picks the signing deck for a creator.
 * Returns { deck, reason, automatic } where `reason` explains the choice in plain words.
 */
export function chooseDeck(creator) {
  const language = creator.deckLanguage || 'English';
  if (LANGUAGE_DECKS[language]) {
    return { deck: LANGUAGE_DECKS[language], automatic: true, reason: `There’s one general deck in ${language}.` };
  }
  const picked = ENGLISH_DECKS.find((d) => d.id === creator.deckOverride);
  if (picked) return { deck: picked, automatic: false, reason: 'Chosen by hand.' };

  const niche = creator.niche?.trim();
  const matches = matchNicheDecks(niche);
  if (matches.length === 1) return { deck: matches[0], automatic: true, reason: `Matched to the niche “${niche}”.` };
  if (!niche) return { deck: TALENT_DECK, automatic: true, reason: 'No niche yet, so this is the general Talent deck.' };
  if (matches.length > 1)
    return {
      deck: TALENT_DECK,
      automatic: true,
      reason: `“${niche}” fits more than one deck (${matches.map((d) => d.short).join(', ')}), so this is the general Talent deck. Pick one below if you prefer.`,
    };
  return { deck: TALENT_DECK, automatic: true, reason: `No niche deck for “${niche}”, so this is the general Talent deck.` };
}
