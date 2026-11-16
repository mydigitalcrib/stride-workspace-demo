import { fileURLToPath as __toPath } from 'node:url';
const ROOT = process.argv[2] || __toPath(new URL('..', import.meta.url));
import { pathToFileURL } from 'node:url';
const { computeAppearance, luminance, mix, safeImageUrl, contrast, THEMES, DEFAULT_APPEARANCE } = await import(pathToFileURL(`${ROOT}/src/appearance.js`));

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n   got ${JSON.stringify(actual)}\n   want ${JSON.stringify(expected)}`}`);
};

const def = computeAppearance(DEFAULT_APPEARANCE);
check('default is the Glass look in dark mode', [DEFAULT_APPEARANCE.theme, DEFAULT_APPEARANCE.mode, def.glass], ['glass', 'dark', true]);
const sage = computeAppearance({ theme: 'sage' });
check('sage keeps original shades', [sage.vars['--accent'], sage.vars['--accent-soft'], sage.vars['--sidebar-bg'], sage.vars['--page-bg']], ['#275c49', '#e0e8d9', '#f0f3eb', '#f7f8f4']);
check('sage is not glass', sage.glass, false);
check('default text mode untouched', def.textMode, 'default');
check('ocean theme', computeAppearance({ theme: 'ocean' }).vars['--accent'], '#2b5d8a');
const custom = computeAppearance({ theme: 'sage', accent: '#e91e63' });
check('custom accent overrides', custom.vars['--accent'], '#e91e63');
check('custom accent drops sage exact shades', custom.vars['--accent-soft'] === '#e0e8d9', false);
check('light accent gets dark button text', computeAppearance({ theme: 'sage', accent: '#ffd54f' }).vars['--on-accent'], '#1d2620');
check('dark accent gets white button text', custom.vars['--on-accent'], '#ffffff');
check('night gradient → light text', computeAppearance({ background: 'night' }).textMode, 'light');
check('dawn gradient → dark text', computeAppearance({ background: 'dawn' }).textMode, 'dark');
check('black colour bg → light text', computeAppearance({ background: 'color', bgColor: '#111111' }).textMode, 'light');
check('pale colour bg → dark text', computeAppearance({ background: 'color', bgColor: '#fdf2e9' }).textMode, 'dark');
check('dark photo, little softening → light text', computeAppearance({ background: 'image', image: 'https://example.com/a.jpg', imageLuminance: 0.05, soften: 0.1 }).textMode, 'light');
check('dark photo, heavy softening → dark text', computeAppearance({ background: 'image', image: 'https://example.com/a.jpg', imageLuminance: 0.05, soften: 0.9 }).textMode, 'dark');
check('manual text choice wins', computeAppearance({ background: 'night', text: 'dark' }).textMode, 'dark');
check('image without a valid url falls back to theme', computeAppearance({ background: 'image', image: 'javascript:alert(1)' }).textMode, 'default');
check('safeImageUrl blocks quotes', safeImageUrl('https://x.com/a.jpg") ; background:red'), '');
check('safeImageUrl allows https', safeImageUrl('https://images.example.com/photo.jpg'), 'https://images.example.com/photo.jpg');
check('mix halfway', mix('#000000', '#ffffff', 0.5), '#808080');
check('luminance white', Math.round(luminance('#ffffff') * 100) / 100, 1);

const classic = THEMES.filter((t) => !t.glass);
check('every classic theme button uses white text', classic.map((t) => computeAppearance({ theme: t.id }).vars['--on-accent']), classic.map(() => '#ffffff'));
check('mid orange accent gets dark button text', computeAppearance({ theme: 'sage', accent: '#e07a1f' }).vars['--on-accent'], '#1d2620');
for (const [theme, accent] of ['sage', 'glass'].flatMap((t) => ['#e07a1f', '#ffd54f', '#7fdbff', '#e91e63', '#2b5d8a', '#00ff00', '#ff3b30'].map((a) => [t, a]))) {
  const v = computeAppearance({ theme, accent }).vars;
  check(`${theme} ${accent}: button text readable (≥3)`, contrast(v['--on-accent'], accent) >= 3, true);
  check(`${theme} ${accent}: accent text readable on soft (≥4.5)`, contrast(v['--accent-text'], v['--accent-soft']) >= 4.5, true);
  check(`${theme} ${accent}: muted text readable on soft (≥4.5)`, contrast(v['--accent-muted'], v['--accent-soft']) >= 4.5, true);
}

// ---- Dark mode ----
const { resolveMode, DARK, GLASS } = await import(pathToFileURL(`${ROOT}/src/appearance.js`));
check('resolve: dark', resolveMode('dark', false), 'dark');
check('resolve: system + device dark', resolveMode('system', true), 'dark');
check('resolve: system + device light', resolveMode('system', false), 'light');
check('resolve: light ignores device', resolveMode('light', true), 'light');
check('dark mode page colour (classic)', computeAppearance({ theme: 'sage' }, 'dark').vars['--page-bg'], DARK.page);
check('dark mode page colour (glass)', computeAppearance({}, 'dark').vars['--page-bg'], GLASS.dark.page);
check('dark mode keeps chosen accent for the picker', computeAppearance({ accent: '#123456' }, 'dark').accent, '#123456');
for (const [theme, accent] of ['sage', 'glass'].flatMap((t) => [...THEMES.map((x) => x.accent), '#e07a1f', '#ffd54f', '#000000', '#0b1f3a', '#00ff00'].map((a) => [t, a]))) {
  const v = computeAppearance({ theme, accent }, 'dark').vars;
  check(`dark ${theme} ${accent}: accent visible on page (≥3)`, contrast(v['--accent'], v['--page-bg']) >= 3, true);
  check(`dark ${theme} ${accent}: button text readable (≥4.5)`, contrast(v['--on-accent'], v['--accent']) >= 4.5, true);
  check(`dark ${theme} ${accent}: accent text on soft (≥4.5)`, contrast(v['--accent-text'], v['--accent-soft']) >= 4.5, true);
  check(`dark ${theme} ${accent}: brand on sidebar (≥7)`, contrast(v['--brand'], v['--sidebar-bg']) >= 7, true);
  check(`dark ${theme} ${accent}: toast text (≥4.5)`, contrast('#ffffff', v['--toast-bg']) >= 4.5, true);
}
// fixed dark palette from dark.css
const surface = '#1b2320', raised = '#222c28';
const pairs = {
  'ink on surface': ['#e3eae6', surface], 'muted on surface': ['#a4b0a9', surface], 'subtle on surface': ['#8d9a92', surface],
  'muted on raised': ['#a4b0a9', raised], 'subtle on page': ['#8d9a92', '#121715'],
  'badge green': ['#9fd19c', '#1f3322'], 'badge gray': ['#aab1a3', '#272e2a'], 'badge blue': ['#9fc3e0', '#1d2d3b'],
  'badge purple': ['#cdb6e0', '#2c2438'], 'badge red': ['#e9a99a', '#3a2421'], 'badge orange': ['#e6c08c', '#392d1d'],
  'error': ['#f0a796', '#3a2421'], 'notice': ['#e8c98a', '#3a3120'], 'th': ['#8d9a92', '#1f2824'],
};
for (const [name, [fg, bg]] of Object.entries(pairs)) check(`dark palette ${name} (≥4.5)`, contrast(fg, bg) >= 4.5, true);

// ---- Glass ----
const glassDark = computeAppearance({}, 'dark');
check('glass: red accent in dark mode', glassDark.vars['--accent'], '#ff3b30');
check('glass: light wordmark in dark mode', glassDark.vars['--brand'], '#f5f5f5');
check('glass light: dark wordmark', computeAppearance({}, 'light').vars['--brand'], '#111111');
check('glass light: accent text readable on pale glass (≥4.5)', contrast(computeAppearance({}, 'light').vars['--accent-text'], GLASS.light.panel) >= 4.5, true);
check('glass: moving backdrop on its own background', glassDark.motion, true);
check('glass: no moving backdrop over a photo', computeAppearance({ background: 'image', image: 'https://example.com/a.jpg' }, 'dark').motion, false);
check('glass: moving backdrop can be turned off', computeAppearance({ motion: false }, 'dark').motion, false);
check('classic themes never move', computeAppearance({ theme: 'rose' }, 'dark').motion, false);
check('saved classic look stays classic', computeAppearance({ theme: 'rose', mode: 'dark' }, 'dark').glass, false);
const { upgradeAppearance } = await import(pathToFileURL(`${ROOT}/src/appearance.js`));
const oldLook = { mode: 'dark', theme: 'rose', accent: '#a34a6a', background: 'image', image: 'data:image/jpeg;base64,AAAA', soften: 0.4 };
const upgraded = upgradeAppearance(oldLook);
check('upgrade: an older saved look switches to Glass once', [upgraded.theme, upgraded.accent, upgraded.background, upgraded.version], ['glass', null, 'theme', 2]);
check('upgrade: keeps mode and the saved photo', [upgraded.mode, upgraded.image, upgraded.soften], ['dark', oldLook.image, 0.4]);
check('upgrade: a look chosen after the upgrade is kept', upgradeAppearance({ theme: 'rose', version: 2 }).theme, 'rose');
check('upgrade: nothing saved stays empty (defaults are Glass)', upgradeAppearance({}), {});
check('new looks are saved as version 2', DEFAULT_APPEARANCE.version, 2);
// fixed glass text colours from glass.css, over the panels as they look on the backdrop
const glassPairs = {
  'dark ink': ['#ffffff', GLASS.dark.panel], 'dark text-2': ['#e4e4e6', GLASS.dark.panel], 'dark muted': ['#a9a9a9', GLASS.dark.panel],
  'dark subtle': ['#8a8a8a', GLASS.dark.panel], 'dark subtle on raised': ['#8a8a8a', '#1a1a1c'],
  'light ink': ['#111111', GLASS.light.panel], 'light muted': ['#505052', GLASS.light.panel], 'light subtle': ['#616163', GLASS.light.panel],
  'light subtle on page': ['#616163', GLASS.light.page],
};
for (const [name, [fg, bg]] of Object.entries(glassPairs)) check(`glass palette ${name} (≥4.5)`, contrast(fg, bg) >= 4.5, true);

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
