import { useRef, useState } from 'react';
import { Check, ImagePlus, Paintbrush, RotateCcw, X } from 'lucide-react';
import {
  GRADIENTS,
  MODES,
  THEMES,
  backgroundColorFor,
  computeAppearance,
  gradientCss,
  prepareBackgroundImage,
  safeImageUrl,
} from './appearance.js';

/** Side panel for choosing light/dark mode, theme colours and the dashboard background. Changes apply live. */
export default function Personalize({ value, mode, onChange, onReset, onClose, error }) {
  const { accent, theme, page } = computeAppearance(value, mode);
  const fileInput = useRef(null);
  const [link, setLink] = useState(value.image?.startsWith('https://') ? value.image : '');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const hasImage = !!safeImageUrl(value.image);

  async function uploadImage(file) {
    setProblem('');
    setBusy(true);
    try {
      const { dataUrl, luminance } = await prepareBackgroundImage(file);
      onChange({ background: 'image', image: dataUrl, imageLuminance: luminance });
      setLink('');
    } catch (err) {
      setProblem(err.message);
    } finally {
      setBusy(false);
    }
  }

  function useLink() {
    const url = safeImageUrl(link);
    if (!url || url.startsWith('data:')) {
      setProblem('Paste an image link that starts with https://');
      return;
    }
    setProblem('');
    onChange({ background: 'image', image: url, imageLuminance: null });
  }

  const tile = (id, name, style, content = null, extra = {}) => (
    <button key={id} type="button" className="bgTile" aria-pressed={value.background === id} onClick={() => onChange({ background: id, ...extra })}>
      <i style={style}>{content}</i>
      {name}
    </button>
  );

  return (
    <div className="overlay clear" onClick={onClose}>
      <section className="drawer personalize" role="dialog" aria-modal="true" aria-label="Personalize" onClick={(e) => e.stopPropagation()}>
        <div className="drawerHead">
          <div>
            <span className="eyebrow">PERSONALIZE</span>
            <h2>Make it yours</h2>
          </div>
          <button className="icon" aria-label="Close personalize" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="drawerBody">
          <p className="help">Changes show straight away and are saved in this browser.</p>

          <h3>Mode</h3>
          <div className="segmented" role="group" aria-label="Light or dark mode">
            {MODES.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={(value.mode || 'light') === id} onClick={() => onChange({ mode: id })}>
                {label}
              </button>
            ))}
          </div>
          {value.mode === 'system' && <p className="help">Your device is in {mode} mode right now. This follows it automatically.</p>}

          <h3>Colour theme</h3>
          <div className="swatches">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="swatch"
                aria-pressed={theme.id === t.id && accent.toLowerCase() === t.accent.toLowerCase()}
                onClick={() => onChange({ theme: t.id, accent: null })}
              >
                <span className="swatchDot" style={{ background: t.accent, '--swatch-side': t.card }} />
                {t.name}
              </button>
            ))}
          </div>
          <label className="colorField">
            Your own accent colour
            <span>
              <code>{accent}</code>
              <input type="color" value={accent} onChange={(e) => onChange({ accent: e.target.value })} aria-label="Accent colour" />
            </span>
          </label>
          <p className="help">
            {theme.glass
              ? 'Glass: frosted panels with a red accent. Your own colour replaces the red on the menu highlight, dots, progress bars and links.'
              : 'Used for buttons, the current page, progress bars and links. The sidebar takes a soft tint of it.'}
          </p>

          <h3>Background</h3>
          <div className="bgGrid">
            {tile('theme', 'Theme', { background: page })}
            {GRADIENTS.map((g) => tile(g.id, g.name, { background: gradientCss(g, mode) }))}
            {tile(
              'color',
              'Any colour',
              {
                background:
                  value.background === 'color'
                    ? backgroundColorFor(value.bgColor, mode)
                    : 'conic-gradient(#f6c1c1, #f6e3b4, #c9ecc9, #bfe0f5, #dccbf2, #f6c1c1)',
              },
              <Paintbrush size={16} />,
              value.background === 'color' ? {} : { bgColor: page },
            )}
            <button
              type="button"
              className="bgTile"
              aria-pressed={value.background === 'image'}
              onClick={() => (hasImage && value.background !== 'image' ? onChange({ background: 'image' }) : fileInput.current?.click())}
            >
              <i style={hasImage ? { backgroundImage: `url("${safeImageUrl(value.image)}")` } : undefined}>
                {!hasImage && <ImagePlus size={16} />}
              </i>
              {busy ? 'Loading…' : hasImage ? 'Your image' : 'Upload image'}
            </button>
          </div>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files?.[0]) uploadImage(e.target.files[0]);
              e.target.value = '';
            }}
          />

          {value.background === 'color' && (
            <label className="colorField">
              Background colour
              <span>
                <code>{value.bgColor}</code>
                <input type="color" value={value.bgColor} onChange={(e) => onChange({ bgColor: e.target.value })} aria-label="Background colour" />
              </span>
            </label>
          )}
          {mode === 'dark' && value.background !== 'image' && value.background !== 'theme' && (
            <p className="help">In dark mode, light backgrounds are shown as a deep shade of the same colour.</p>
          )}

          {value.background === 'image' && hasImage && (
            <div className="imageControls">
              <label>
                Soften image
                <span className="rangeRow">
                  <input
                    type="range"
                    min={0}
                    max={90}
                    step={5}
                    value={Math.round((value.soften ?? 0.55) * 100)}
                    onChange={(e) => onChange({ soften: Number(e.target.value) / 100 })}
                  />
                  <b>{Math.round((value.soften ?? 0.55) * 100)}%</b>
                </span>
              </label>
              <small className="help">More softening makes headings easier to read over a busy photo.</small>
              <div className="imageButtons">
                <button type="button" onClick={() => fileInput.current?.click()}>
                  <ImagePlus size={14} />
                  Change image
                </button>
                <button type="button" onClick={() => onChange({ background: 'theme', image: '', imageLuminance: null })}>
                  Remove image
                </button>
              </div>
            </div>
          )}

          <div className="imageLink">
            <label>
              Or use an image link
              <input type="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />
            </label>
            <button type="button" onClick={useLink}>
              Use link
            </button>
          </div>
          <p className="help">Uploaded images are resized and stored in this browser only. Large photos may be too big to keep.</p>

          {theme.glass && value.background === 'theme' && (
            <>
              <h3>Moving light</h3>
              <div className="segmented" role="group" aria-label="Moving light and specks">
                {[
                  [true, 'On'],
                  [false, 'Off'],
                ].map(([on, label]) => (
                  <button key={label} type="button" aria-pressed={(value.motion !== false) === on} onClick={() => onChange({ motion: on })}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="help">A slow light beam and drifting specks behind the glass. Turn it off if the computer feels slow.</p>
            </>
          )}

          <h3>Text on the background</h3>
          <div className="segmented" role="group" aria-label="Text on the background">
            {[
              ['auto', 'Auto'],
              ['dark', 'Dark'],
              ['light', 'Light'],
            ].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={(value.text || 'auto') === id} onClick={() => onChange({ text: id })}>
                {label}
              </button>
            ))}
          </div>
          <p className="help">For the page title and notes that sit directly on your background. Auto picks what’s easiest to read.</p>

          {(problem || error) && <div className="error">{problem || error}</div>}
        </div>

        <div className="drawerFoot">
          <button type="button" className="resetBtn" onClick={onReset}>
            <RotateCcw size={14} />
            Reset to default
          </button>
          <button type="button" className="primary" onClick={onClose}>
            Done
            <Check size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
