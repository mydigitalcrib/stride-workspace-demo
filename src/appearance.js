// Personalisation: colour themes, accent colour and dashboard background.
// Saved in this browser only (separately from creator data).

export const APPEARANCE_KEY = 'stride-talent-workspace:appearance:v1';

/** Ready-made themes. Glass is the main look; Sage is the original one. */
export const THEMES = [
  // Frosted glass panels over a near-black (dark) or studio-grey (light) backdrop, with a red accent.
  { id: 'glass', name: 'Glass', accent: '#ff3b30', sidebar: '#f3f3f4', card: '#2a2a2c', page: '#e9e9eb', glass: true },
  {
    id: 'sage',
    name: 'Sage',
    accent: '#275c49',
    sidebar: '#f0f3eb',
    card: '#e5ebdd',
    page: '#f7f8f4',
    // exact original shades, so the default look doesn't change
    exact: {
      '--accent-hover': '#174532',
      '--accent-soft': '#e0e8d9',
      '--accent-softer': '#e9f0e3',
      '--accent-wash': '#eff3e7',
      '--accent-badge': '#cbd9bd',
      '--accent-text': '#1d513d',
      '--accent-muted': '#4f6f45',
      '--brand': '#153b31',
      '--toast-bg': '#1e4737',
    },
  },
  { id: 'ocean', name: 'Ocean', accent: '#2b5d8a', sidebar: '#edf2f7', card: '#dfe8f1', page: '#f6f8fb' },
  { id: 'rose', name: 'Rose', accent: '#a34a6a', sidebar: '#f8eef1', card: '#f0dde4', page: '#fbf7f8' },
  { id: 'lavender', name: 'Lavender', accent: '#6a55a3', sidebar: '#f1eff8', card: '#e4def2', page: '#f8f7fc' },
  { id: 'terracotta', name: 'Terracotta', accent: '#b0583a', sidebar: '#f8efe9', card: '#f0ddd2', page: '#fbf7f4' },
  { id: 'charcoal', name: 'Charcoal', accent: '#2f3a40', sidebar: '#eff1f2', card: '#e1e5e7', page: '#f6f7f8' },
];

/** Background gradients. `dark` ones get light heading text automatically; `darkCss` is used in dark mode. */
export const GRADIENTS = [
  {
    id: 'dawn',
    name: 'Dawn',
    css: 'linear-gradient(135deg, #fdf6f0 0%, #f3e7e9 50%, #e3eeff 100%)',
    darkCss: 'linear-gradient(135deg, #1f1a1c 0%, #1d1a24 50%, #161d2b 100%)',
    dark: false,
  },
  {
    id: 'meadow',
    name: 'Meadow',
    css: 'linear-gradient(135deg, #f4f8ee 0%, #dcebdc 100%)',
    darkCss: 'linear-gradient(135deg, #151c16 0%, #1a2a1e 100%)',
    dark: false,
  },
  {
    id: 'sky',
    name: 'Sky',
    css: 'linear-gradient(160deg, #f1f7fc 0%, #d6e6f5 100%)',
    darkCss: 'linear-gradient(160deg, #121a22 0%, #1a2a3b 100%)',
    dark: false,
  },
  {
    id: 'blush',
    name: 'Blush',
    css: 'linear-gradient(135deg, #fff3f4 0%, #f3dbe5 100%)',
    darkCss: 'linear-gradient(135deg, #1f1719 0%, #2b1c25 100%)',
    dark: false,
  },
  {
    id: 'sand',
    name: 'Sand',
    css: 'linear-gradient(135deg, #fbf7f0 0%, #ecdfcb 100%)',
    darkCss: 'linear-gradient(135deg, #1c1915 0%, #2a2319 100%)',
    dark: false,
  },
  { id: 'night', name: 'Night', css: 'linear-gradient(160deg, #1d2833 0%, #33475b 100%)', dark: true },
];

/** The gradient as shown in the given mode. */
export const gradientCss = (gradient, mode) => (mode === 'dark' && gradient.darkCss ? gradient.darkCss : gradient.css);

/** In dark mode a light background colour is shown as a deep shade of itself. */
export const backgroundColorFor = (hex, mode) => (mode === 'dark' && luminance(hex) > 0.2 ? mix(hex, DARK.page, 0.88) : hex);

/** Base colours for dark mode (the accent is layered on top). */
export const DARK = { page: '#121715', sidebar: '#161d1a', surface: '#1b2320' };

/**
 * Base colours for the Glass look. Panels are see-through in the page (see glass.css);
 * `panel` and `sidebar` are what they look like over the backdrop, used to keep text readable.
 */
export const GLASS = {
  dark: { page: '#040404', panel: '#0f0f10', sidebar: '#0d0d0e' },
  light: { page: '#e9e9eb', panel: '#f6f6f7', sidebar: '#f3f3f4' },
};

export const MODES = [
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['system', 'Match my device'],
];

export const DEFAULT_APPEARANCE = {
  mode: 'dark', // 'light' | 'dark' | 'system'
  theme: 'glass',
  accent: null, // a custom accent colour; null = the theme's own
  background: 'theme', // 'theme' | 'color' | 'image' | a gradient id
  bgColor: '#f7f8f4',
  image: '', // data: URL of an uploaded image, or an https:// link
  imageLuminance: null, // 0 (black) – 1 (white), measured on upload; null when unknown
  soften: 0.55, // how much of the theme colour is laid over an image (0 – 0.9)
  text: 'auto', // text colour on the background: 'auto' | 'dark' | 'light'
  motion: true, // Glass only: the slow light beam and drifting specks behind the panels
  version: 2, // see upgradeAppearance
};

/**
 * Version 2 (November 2026) made Glass the main look. A look saved before then switches to Glass once,
 * keeping light/dark mode; a saved photo or colour stays stored, one click away in Personalize.
 */
export function upgradeAppearance(saved) {
  if (!saved || typeof saved !== 'object' || !Object.keys(saved).length || Number(saved.version) >= 2) return saved;
  return { ...saved, theme: 'glass', accent: null, background: 'theme', version: 2 };
}

export function loadAppearance() {
  try {
    return { ...DEFAULT_APPEARANCE, ...upgradeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) || '{}')) };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

/** Throws when the browser can't store it (usually an image that's too large). */
export function saveAppearance(appearance) {
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
}

// ---- colour maths ----

const hexToRgb = (hex) => {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0').slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
};
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** Mixes `hex` with `other`; amount 0 = all hex, 1 = all other. */
export const mix = (hex, other, amount) => {
  const a = hexToRgb(hex);
  const b = hexToRgb(other);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * amount));
};

/** Relative luminance (WCAG): 0 = black, 1 = white. */
export function luminanceOfRgb([r, g, b]) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export const luminance = (hex) => luminanceOfRgb(hexToRgb(hex));

const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));

/** WCAG contrast ratio between two colours (1 – 21). */
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Darkens `hex` until it reaches `min` contrast against `bg`. */
function readableOn(hex, bg, min) {
  let out = hex;
  for (let step = 0.05; contrast(out, bg) < min && step <= 1; step += 0.05) out = mix(hex, '#000000', step);
  return out;
}

/** Lightens `hex` until it reaches `min` contrast against a dark `bg`. */
function lightenOn(hex, bg, min) {
  let out = hex;
  for (let step = 0.05; contrast(out, bg) < min && step <= 1; step += 0.05) out = mix(hex, '#ffffff', step);
  return out;
}

/** Resolves 'system' to 'light' or 'dark'. */
export const resolveMode = (mode, systemPrefersDark) => (mode === 'dark' || (mode === 'system' && systemPrefersDark) ? 'dark' : 'light');

/** Only data: images and https:// links are used as a background. */
export function safeImageUrl(url) {
  const u = String(url || '').trim();
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(u)) return u;
  if (/^https:\/\/[^\s"'()\\]+$/i.test(u)) return u;
  return '';
}

const DARK_INK = '#1d2620';
/** Button text: whichever of white or near-black reads better on the colour. */
const textOn = (bg) => (contrast('#ffffff', bg) >= contrast(DARK_INK, bg) ? '#ffffff' : DARK_INK);

function lightVars(accent, theme, customAccent) {
  const sidebar = customAccent ? mix(accent, '#ffffff', 0.93) : theme.sidebar;
  const page = customAccent ? mix(accent, '#ffffff', 0.965) : theme.page;
  const soft = mix(accent, '#ffffff', 0.8);
  return {
    page,
    vars: {
      '--accent': accent,
      '--accent-hover': mix(accent, '#000000', 0.22),
      '--accent-soft': soft,
      '--accent-softer': mix(accent, '#ffffff', 0.9),
      '--accent-wash': mix(accent, '#ffffff', 0.93),
      '--accent-badge': mix(accent, '#ffffff', 0.7),
      // text colours are darkened until they're easy to read on their pale backgrounds
      '--accent-text': readableOn(mix(accent, '#000000', 0.1), soft, 5),
      '--accent-muted': readableOn(accent, soft, 4.5),
      '--on-accent': textOn(accent),
      '--brand': readableOn(mix(accent, '#000000', 0.35), sidebar, 7),
      '--toast-bg': mix(accent, '#000000', 0.55),
      '--sidebar-bg': sidebar,
      '--sidebar-card': customAccent ? mix(accent, '#ffffff', 0.85) : theme.card,
      '--page-bg': page,
      ...(!customAccent && theme.exact ? theme.exact : {}),
    },
  };
}

const GLASS_INK = '#0a0a0a';
/** Glass button text: white or near-black, whichever reads better on the colour. */
const glassTextOn = (bg) => (contrast('#ffffff', bg) >= contrast(GLASS_INK, bg) ? '#ffffff' : GLASS_INK);

function glassVars(accent, mode) {
  const g = GLASS[mode];
  if (mode === 'dark') {
    // A dark accent would disappear on the near-black page, so lift it until it stands out.
    const base = lightenOn(accent, g.page, 3.2);
    const soft = mix(base, g.panel, 0.8);
    return {
      page: g.page,
      vars: {
        '--accent': base,
        '--accent-hover': mix(base, '#000000', 0.15),
        '--accent-soft': soft,
        '--accent-softer': mix(base, g.panel, 0.88),
        '--accent-wash': mix(base, g.panel, 0.93),
        '--accent-badge': mix(base, g.panel, 0.6),
        '--accent-text': lightenOn(base, soft, 5),
        '--accent-muted': lightenOn(base, soft, 4.5),
        '--on-accent': glassTextOn(base),
        '--brand': '#f5f5f5',
        '--toast-bg': '#1c1c1e',
        '--sidebar-bg': g.sidebar,
        '--sidebar-card': mix(base, g.sidebar, 0.9),
        '--page-bg': g.page,
      },
    };
  }
  const soft = mix(accent, g.panel, 0.84);
  return {
    page: g.page,
    vars: {
      '--accent': accent,
      '--accent-hover': mix(accent, '#000000', 0.15),
      '--accent-soft': soft,
      '--accent-softer': mix(accent, g.panel, 0.9),
      '--accent-wash': mix(accent, g.panel, 0.94),
      '--accent-badge': mix(accent, g.panel, 0.7),
      // text colours are darkened until they're easy to read on the pale glass
      '--accent-text': readableOn(mix(accent, '#000000', 0.1), soft, 5),
      '--accent-muted': readableOn(accent, soft, 4.5),
      '--on-accent': glassTextOn(accent),
      '--brand': '#111111',
      '--toast-bg': '#1c1c1e',
      '--sidebar-bg': g.sidebar,
      '--sidebar-card': mix(accent, g.sidebar, 0.92),
      '--page-bg': g.page,
    },
  };
}

function darkVars(accent) {
  // A dark accent would disappear on a dark page, so lift it until it stands out.
  const base = lightenOn(accent, DARK.page, 3.2);
  const soft = mix(base, DARK.surface, 0.78);
  const sidebar = mix(accent, DARK.sidebar, 0.93);
  return {
    page: DARK.page,
    vars: {
      '--accent': base,
      '--accent-hover': mix(base, '#000000', 0.18),
      '--accent-soft': soft,
      '--accent-softer': mix(base, DARK.surface, 0.86),
      '--accent-wash': mix(base, DARK.surface, 0.91),
      '--accent-badge': mix(base, DARK.surface, 0.6),
      // text colours are lightened until they're easy to read on their dark backgrounds
      '--accent-text': lightenOn(base, soft, 5),
      '--accent-muted': lightenOn(base, soft, 4.5),
      '--on-accent': glassTextOn(base),
      '--brand': lightenOn(mix(base, '#ffffff', 0.25), sidebar, 7),
      '--toast-bg': mix(base, '#000000', 0.5),
      '--sidebar-bg': sidebar,
      '--sidebar-card': mix(base, DARK.sidebar, 0.84),
      '--page-bg': DARK.page,
    },
  };
}

/**
 * Turns saved settings into CSS variables, the backdrop style and the text mode.
 * `mode` is the resolved mode ('light' or 'dark').
 * textMode: 'default' (the mode's normal look), 'dark' or 'light' text on the background.
 */
export function computeAppearance(saved, mode = 'light') {
  const a = { ...DEFAULT_APPEARANCE, ...saved };
  const theme = THEMES.find((t) => t.id === a.theme) || THEMES[0];
  const accent = isHex(a.accent) ? a.accent : theme.accent;
  const customAccent = accent.toLowerCase() !== theme.accent.toLowerCase();
  const glass = !!theme.glass;
  const { vars, page } = glass ? glassVars(accent, mode) : mode === 'dark' ? darkVars(accent) : lightVars(accent, theme, customAccent);

  let backdrop;
  let tint = null;
  let bgLum;
  const gradient = GRADIENTS.find((g) => g.id === a.background);
  const image = safeImageUrl(a.image);
  if (a.background === 'color' && isHex(a.bgColor)) {
    const color = backgroundColorFor(a.bgColor, mode);
    backdrop = { background: color };
    bgLum = luminance(color);
  } else if (a.background === 'image' && image) {
    backdrop = { backgroundColor: page, backgroundImage: `url("${image}")` };
    const soften = Math.max(0, Math.min(0.9, Number(a.soften) || 0));
    tint = { background: page, opacity: soften };
    bgLum =
      a.imageLuminance == null
        ? soften >= 0.5
          ? 0.8
          : 0.25
        : (1 - soften) * a.imageLuminance + soften * luminance(page);
  } else if (gradient) {
    backdrop = { background: gradientCss(gradient, mode) };
    bgLum = gradient.dark || mode === 'dark' ? 0.05 : 0.85;
  } else {
    backdrop = { background: page };
    bgLum = null; // theme colour: keep the original text colours
  }

  const textMode = a.text === 'dark' || a.text === 'light' ? a.text : bgLum == null ? 'default' : bgLum < 0.35 ? 'light' : 'dark';
  // The Glass backdrop's moving light and specks only show on its own background, not over a photo or colour.
  const motion = glass && a.background === 'theme' && a.motion !== false;
  return { vars, backdrop, tint, textMode, accent, theme, page, mode, glass, motion };
}

/** Applies computed colours to the whole page (used by the app and the lock screen). */
export function applyAppearance(look) {
  const root = document.documentElement;
  root.setAttribute('data-mode', look.mode);
  if (look.glass) root.setAttribute('data-look', 'glass');
  else root.removeAttribute('data-look');
  // index.html paints the page colour early to avoid a white flash; drop it so the background layer shows.
  root.style.removeProperty('background');
  Object.entries(look.vars).forEach(([name, value]) => root.style.setProperty(name, value));
  if (look.textMode === 'default') root.removeAttribute('data-bg-text');
  else root.setAttribute('data-bg-text', look.textMode);
}

/**
 * Reads an image file, shrinks it so it fits in browser storage, and measures how light it is.
 * Returns { dataUrl, luminance }.
 */
export async function prepareBackgroundImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Pick an image file (JPG, PNG or WebP).');
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Couldn’t read that image. Try a JPG or PNG.'));
      el.src = objectUrl;
    });
    const encode = (maxSide, quality) => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // transparent PNGs become white, not black
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', quality);
    };
    let dataUrl = encode(1600, 0.8);
    if (dataUrl.length > 1_500_000) dataUrl = encode(1280, 0.7);

    const sample = document.createElement('canvas');
    sample.width = 24;
    sample.height = 24;
    const sctx = sample.getContext('2d');
    sctx.drawImage(img, 0, 0, 24, 24);
    const px = sctx.getImageData(0, 0, 24, 24).data;
    let total = 0;
    for (let i = 0; i < px.length; i += 4) total += luminanceOfRgb([px[i], px[i + 1], px[i + 2]]);
    return { dataUrl, luminance: total / (px.length / 4) };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
